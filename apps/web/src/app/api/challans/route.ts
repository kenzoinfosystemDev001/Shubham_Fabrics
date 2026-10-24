
import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { inactiveDepartmentError } from '@/lib/departments';
import { authorizeDefectReport, normalizeShelfDepartment, DEFECTIVE_SHELF_INFO, DefectiveShelfDepartment } from '@/lib/defective-shelf';
import { syncInboundChallansToDyeingOrders } from '@/lib/dyeing-sync';
import { normalizeDepartmentCode } from '@subham/types';
import {
  challanNumberErrorResponse,
  duplicateChallanNumberResponse,
  isDuplicateChallanNumberError,
  validateManualChallanNumber,
} from '@/lib/challan-number';
import {
  challanItemStockLine,
  describeFabricStockShortages,
  findFabricStockShortages,
  isFabricStoreDepartment,
} from '@/lib/fabric-stock';
import { loadFabricStockLedger, lockFabricStoreStock, recordStockMovements } from '@/lib/fabric-stock-ledger';

class ChallanRequestError extends Error {
  constructor(message: string, public status: number, public details?: Record<string, unknown>) {
    super(message);
  }
}

function optionalPositiveNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const fromDepartment = searchParams.get('fromDepartment');
    const toDepartment = searchParams.get('toDepartment');
    const status = searchParams.get('status');
    const programId = searchParams.get('programId');

    const where: any = {};

    if (department) {
      where.OR = [
        { fromDepartment: department },
        { toDepartment: department },
      ];
    }

    if (fromDepartment) where.fromDepartment = fromDepartment;
    if (toDepartment) where.toDepartment = toDepartment;
    if (status) where.status = status;
    if (programId) where.programId = programId;

    const challans = await prisma.challan.findMany({
      where,
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            buyerName: true,
            clientName: true,
            mainStyle: true,
            wilcomDesignNumber: true,
            fabricName: true,
            fabricColor: true,
            styleCode: true,
            orderNumber: true,
            designName: true,
          },
        },
        fromDeptRel: true,
        toDeptRel: true,
        parentChallan: {
          select: {
            id: true,
            challanNumber: true,
            fromDepartment: true,
            toDepartment: true,
            fabricIn: true,
            fabricOut: true,
            fabricUnit: true,
            defectivePieces: true,
            status: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(challans);
  } catch (error: any) {
    console.error('Error fetching challans:', error);

    return NextResponse.json(
      { error: error.message || 'Failed to fetch challans' },
      { status: 500 }
    );
  }
}

function parseSafeDate(val: any, fallback?: Date | null): Date | null {
  if (!val) {
    return fallback !== undefined ? fallback : null;
  }

  if (val instanceof Date) {
    return isNaN(val.getTime())
      ? fallback !== undefined ? fallback : null
      : val;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();

    if (!trimmed) {
      return fallback !== undefined ? fallback : null;
    }

    const dmyMatch = trimmed.match(
      /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/
    );

    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const d = new Date(Date.UTC(year, month, day, 12, 0, 0));

      if (!isNaN(d.getTime())) return d;
    }

    const ymdMatch = trimmed.match(
      /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/
    );

    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      const d = new Date(Date.UTC(year, month, day, 12, 0, 0));

      if (!isNaN(d.getTime())) return d;
    }

    const parsed = new Date(trimmed);

    if (!isNaN(parsed.getTime())) return parsed;
  }

  return fallback !== undefined ? fallback : null;
}

export async function POST(request: Request) {
  let challanNumber = '';
  try {
    const body = await request.json();

    // 0. Challan number is entered manually by the issuing department — never generated here.
    const numberCheck = await validateManualChallanNumber(body.challanNumber);
    if (!numberCheck.ok) return challanNumberErrorResponse(numberCheck);
    challanNumber = numberCheck.challanNumber;

    // 1. Resolve Actor ID reliably
    let user = null;

    if (body.issuedById) {
      user = await prisma.user.findUnique({
        where: { id: body.issuedById },
        select: { id: true },
      }).catch(() => null);
    }

    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: 'store' },
            { username: 'programmer' },
            { username: 'admin' },
            { username: 'jitender' },
          ],
        },
        select: { id: true },
      });
    }

    if (!user) {
      user = await prisma.user.findFirst({
        select: { id: true },
      });
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          username: 'programmer',
          email: 'programmer@subhamfabrics.com',
          fullName: 'Programming Incharge',
          passwordHash: '$2b$10$e7v1vT7Qf0K6bSubhamFabricsMESSecureHash',
          departmentCode: 'PROGRAMMING',
        },
        select: { id: true },
      });
    }

    const actorId = user.id;

    // 2. Resolve Program ID. A challan must belong to the production sheet it was issued for.
    if (!body.programId) {
      return NextResponse.json(
        { error: 'Select the Production Sheet / Serial Number this challan belongs to.' },
        { status: 400 }
      );
    }
    const resolvedProgram = await prisma.program.findFirst({
      where: {
        OR: [
          { id: body.programId },
          { programNumber: body.programId },
          { programSerialNo: body.programId },
        ],
      },
      select: { id: true, fabricName: true },
    });
    if (!resolvedProgram) {
      return NextResponse.json(
        { error: `Production Sheet ${body.programId} was not found.` },
        { status: 404 }
      );
    }
    const resolvedProgramId = resolvedProgram.id;

    // Delivery deadline entered on the challan (optional; never defaulted).
    const issuedDate = parseSafeDate(body.issuedDate, new Date()) || new Date();
    const deliveryDate = parseSafeDate(body.deliveryDate, null);
    if (body.deliveryDate && !deliveryDate) {
      return NextResponse.json({ error: 'Delivery Date is not a valid date.', field: 'deliveryDate' }, { status: 400 });
    }
    if (deliveryDate && deliveryDate.toISOString().slice(0, 10) < issuedDate.toISOString().slice(0, 10)) {
      return NextResponse.json({ error: 'Delivery Date cannot be before the Challan Date.', field: 'deliveryDate' }, { status: 400 });
    }

    // 3. Ensure departments exist in the Department table
    const fromDept = normalizeDepartmentCode(body.fromDepartment || 'PROGRAMMING');
    const toDept = normalizeDepartmentCode(body.toDepartment || 'STORE');

    await prisma.department.upsert({
      where: { code: fromDept },
      update: {},
      create: {
        code: fromDept,
        name:
          fromDept === 'PROGRAMMING'
            ? 'Programming Department'
            : `${fromDept} Department`,
        sequenceOrder: fromDept === 'PROGRAMMING' ? 0 : 99,
        description: `${fromDept} MES Department`,
      },
    });

    await prisma.department.upsert({
      where: { code: toDept },
      update: {},
      create: {
        code: toDept,
        name:
          toDept === 'STORE'
            ? 'Raw Material & Fabric Store'
            : `${toDept} Department`,
        sequenceOrder: toDept === 'STORE' ? 1 : 99,
        description: `${toDept} MES Department`,
      },
    });

    const departmentBlocked = await inactiveDepartmentError(prisma, [fromDept, toDept]);
    if (departmentBlocked) return NextResponse.json({ error: departmentBlocked }, { status: 409 });

    // =========================================================================
    // FABRIC STORE MANDATORY AVAILABILITY GATE
    // "If the fabric is available in the store then only the production sheet will move to the next department"
    // Block movement from STORE to downstream departments (or bypassing STORE directly to DYEING/EMBROIDERY)
    // if the fabric is not verified/in stock in the Fabric Store.
    // =========================================================================
    const isMovingOutFromStore =
      (fromDept === 'STORE' || fromDept.includes('STR') || fromDept.includes('FABRIC')) &&
      toDept !== 'STORE';

    const isBypassingToProcessing =
      fromDept === 'PROGRAMMING' &&
      toDept !== 'STORE' &&
      (toDept === 'DYEING' || toDept === 'EMBROIDERY');

    if (isMovingOutFromStore || isBypassingToProcessing) {
      const { checkFabricStoreAvailability } = await import('@/lib/fabric-availability');
      const firstItemWithUnit = Array.isArray(body.items)
        ? body.items.find((item: any) => item?.uom || item?.unit)
        : undefined;
      const requestedUnit = String(
        firstItemWithUnit?.uom ||
        firstItemWithUnit?.unit ||
        body.fabricUnit ||
        ''
      ).toUpperCase();
      const unitOverride = requestedUnit === 'MTR' || requestedUnit === 'PCS'
        ? requestedUnit
        : undefined;
      const availability = await checkFabricStoreAvailability(resolvedProgramId, unitOverride);
      // Fabric Store issues are checked line by line (fabric + colour + unit) inside the
      // transaction below; here only the Store Incharge's explicit hold blocks them.
      const blocked = isMovingOutFromStore && isFabricStoreDepartment(fromDept)
        ? availability.statusLabel === 'OUT_OF_STOCK'
        : !availability.isAvailable;
      if (blocked) {
        return NextResponse.json(
          {
            error: `Fabric is not available in Fabric Store for Program ${availability.programSerialNo || resolvedProgramId}. ${availability.message}`,
            fabricAvailability: availability,
          },
          { status: 400 }
        );
      }
    }

    // 5. Auto-Detection of Fabric / Pieces In from Previous Department
    let detectedFabricIn: number | null = null;
    let detectedFromDept: string | null = body.detectedFromDepartment || null;
    let detectedFromChallanId: string | null = body.detectedFromChallanId || body.parentChallanId || null;
    let detectedUnit: string = body.fabricUnit || body.uom || 'MTR';

    if (body.parentChallanId) {
      const parent = await prisma.challan.findUnique({
        where: { id: body.parentChallanId },
        include: { items: true },
      });
      if (parent) {
        const pItemsTotal = parent.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
        detectedFabricIn = parent.fabricOut ?? (pItemsTotal > 0 ? pItemsTotal : parent.fabricIn ?? 0);
        detectedFromDept = parent.fromDepartment;
        detectedFromChallanId = parent.id;
        if (parent.fabricUnit) detectedUnit = parent.fabricUnit;
        else if (parent.items[0]?.uom) detectedUnit = parent.items[0].uom;
      }
    } else if (resolvedProgramId && fromDept !== 'PROGRAMMING') {
      const priorChallan = await prisma.challan.findFirst({
        where: {
          programId: resolvedProgramId,
          toDepartment: { contains: fromDept, mode: 'insensitive' },
        },
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      });
      if (priorChallan) {
        const prItemsTotal = priorChallan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
        detectedFabricIn = priorChallan.fabricOut ?? (prItemsTotal > 0 ? prItemsTotal : priorChallan.fabricIn ?? 0);
        detectedFromDept = priorChallan.fromDepartment;
        detectedFromChallanId = priorChallan.id;
        if (priorChallan.fabricUnit) detectedUnit = priorChallan.fabricUnit;
        else if (priorChallan.items[0]?.uom) detectedUnit = priorChallan.items[0].uom;
      }
    }

    const rawItemsSum = (Array.isArray(body.items) ? body.items : []).reduce(
      (sum: number, it: any) => sum + (Number(it.quantity ?? it.measurement) || 0),
      0
    );

    const isFabricStoreIssue = fromDept === 'STORE' &&
      (body.challanType === 'STORE_TO_DYEING' || body.challanType === 'STORE_TO_EMBROIDERY');
    const storeItemUnits = isFabricStoreIssue
      ? new Set<string>((Array.isArray(body.items) ? body.items : [])
          .map((item: any) => String(item?.uom || item?.unit || body.fabricUnit || 'MTR').toUpperCase()))
      : new Set<string>();
    if (isFabricStoreIssue && Array.from(storeItemUnits).some((unit) => !['MTR', 'PCS'].includes(unit))) {
      return NextResponse.json({ error: 'Fabric Store challan items must use MTR or PCS.' }, { status: 400 });
    }
    // Lines may mix meters and pieces; each line keeps its own unit and is deducted from that unit's stock.
    const isMixedUnitStoreIssue = isFabricStoreIssue && storeItemUnits.size > 1;
    const storeItemUnit = isMixedUnitStoreIssue
      ? undefined
      : storeItemUnits.values().next().value as string | undefined;
    if (isMixedUnitStoreIssue && Number(body.defectivePieces || 0) > 0) {
      return NextResponse.json({ error: 'A defective quantity cannot be recorded on a challan that mixes MTR and PCS lines.' }, { status: 400 });
    }
    if (body.challanType === 'STORE_TO_DYEING') {
      const storeLines: any[] = Array.isArray(body.items) ? body.items : [];
      for (const [index, item] of storeLines.entries()) {
        const requiredColor = String(item?.requiredDyeColor || '').trim();
        if (!requiredColor) {
          return NextResponse.json({ error: `Line ${index + 1}: Required Dyeing Color is mandatory on a Fabric Store → Dyeing challan.` }, { status: 400 });
        }
        const requiredQty = optionalPositiveNumber(item?.requiredDyeQuantity);
        const issuedQty = Number(item?.quantity ?? item?.measurement);
        if (requiredQty !== null && (!Number.isFinite(requiredQty) || requiredQty <= 0)) {
          return NextResponse.json({ error: `Line ${index + 1}: Required quantity to dye must be a positive number.` }, { status: 400 });
        }
        if (requiredQty !== null && Number.isFinite(issuedQty) && requiredQty > issuedQty + 1e-9) {
          return NextResponse.json({ error: `Line ${index + 1}: Required quantity to dye (${requiredQty}) cannot exceed the fabric quantity issued (${issuedQty}).` }, { status: 400 });
        }
      }
    }

    const defectivePieces = Number(body.defectivePieces || 0);
    const fabricUnit = isMixedUnitStoreIssue
      ? 'MIXED'
      : (isFabricStoreIssue && storeItemUnit) || body.fabricUnit || detectedUnit || body.uom || 'MTR';
    const submittedDefectReason = String(body.defectReason || '').trim();
    let defectReporterId = actorId;
    let defectReporterName = '';
    if (defectivePieces > 0) {
      const auth = await authorizeDefectReport(request, fromDept);
      if (!auth.actor) return auth.response;
      defectReporterId = auth.actor.id;
      defectReporterName = auth.actor.fullName;
    }
    const shelfDepartments = new Set([
      'DYEING', 'DYEING_QC', 'EMBROIDERY', 'THREAD_CUTTING', 'THREADCUT_QC', 'WASHING', 'WASHING_QC', 'RECUTTING', 'STITCHING', 'FINISHING', 'STEAM_PRESS', 'FINAL_QC', 'PACKING',
    ]);
    if (defectivePieces > 0 && !shelfDepartments.has(fromDept)) {
      return NextResponse.json({ error: 'A departmental defective shelf is available only from Dyeing through Packing.' }, { status: 400 });
    }
    if (defectivePieces > 0 && (normalizeShelfDepartment(toDept) === 'STORE' || ['DEFECT_RETURN', 'DEFECTIVE_RETURN'].includes(String(body.challanType || '').toUpperCase()))) {
      return NextResponse.json({ error: 'Defective material must remain on the reporting department shelf. Do not create a Store transfer challan.' }, { status: 400 });
    }
    if (defectivePieces > 0 && !submittedDefectReason) {
      return NextResponse.json({ error: 'Reason for defect is required before sending material to a defective shelf.' }, { status: 400 });
    }
    const hasMeasuredStoreItems = isFabricStoreIssue && Boolean(storeItemUnit) && rawItemsSum > 0;

    if (
      isFabricStoreIssue &&
      defectivePieces > 0 &&
      body.fabricUnit &&
      String(body.fabricUnit).toUpperCase() !== fabricUnit
    ) {
      return NextResponse.json({ error: 'The defective quantity unit must match the challan item unit.' }, { status: 400 });
    }

    // A mixed MTR + PCS challan has no meaningful single total, so header totals stay empty.
    const fabricIn = isMixedUnitStoreIssue
      ? null
      : hasMeasuredStoreItems
      ? rawItemsSum + defectivePieces
      : body.fabricIn !== undefined && body.fabricIn !== null && body.fabricIn !== ''
        ? Number(body.fabricIn)
        : (detectedFabricIn ?? (rawItemsSum || Number(body.quantity || 1)));

    const fabricOut = isMixedUnitStoreIssue
      ? null
      : hasMeasuredStoreItems
      ? rawItemsSum
      : body.fabricOut !== undefined && body.fabricOut !== null && body.fabricOut !== ''
        ? Number(body.fabricOut)
        : Math.max(0, (fabricIn ?? 0) - defectivePieces);
    const getDefaultDefectiveShelf = (dept: string) => {
      const up = dept.toUpperCase();
      if (up.includes('DYEING_QC') || up.includes('DYEING QC') || up.includes('DYE QC'))
        return 'DEF-SHELF-DYEING-QC (Dyeing QC Defective Shelf)';
      if (up.includes('DYE')) return 'DEF-SHELF-DYEING (Dyeing Station Defective Shelf)';
      if (up.includes('EMB')) return 'DEF-SHELF-EMBROIDERY (Embroidery Station Defective Shelf)';
      if (up.includes('THREADCUT_QC') || up.includes('THREAD CUT QC') || up.includes('THREAD CUTTING QC'))
        return 'DEF-SHELF-THREADCUT-QC (Threadcut QC Defective Shelf)';
      if (up.includes('RECUT')) return 'DEF-SHELF-RECUTTING (Recutting Defective Shelf)';
      if (up.includes('THREAD') || up.includes('CUTTING') || up.includes('THC'))
        return 'DEF-SHELF-THREAD-CUTTING (Thread Cutting Trimming Shelf)';
      if (up.includes('WASHING_QC') || up.includes('WASHING QC') || up.includes('WASH QC'))
        return 'DEF-SHELF-WASHING-QC (Washing QC Defective Shelf)';
      if (up.includes('WASH')) return 'DEF-SHELF-WASHING (Washing Station Defective Shelf)';
      if (up.includes('STITCH')) return 'DEF-SHELF-STITCHING (Stitching Defective Shelf)';
      if (up.includes('FINISH')) return 'DEF-SHELF-FINISHING (Finishing Defective Shelf)';
      if (up.includes('STEAM') || up.includes('PRESS')) return 'DEF-SHELF-STEAM-PRESS (Steam Press Defective Shelf)';
      if (up.includes('PACK')) return 'DEF-SHELF-PACKING (Packing Defective Shelf)';
      if (up.includes('FINAL'))
        return 'DEF-SHELF-FINAL-QC (Final QC Defective Shelf)';
      return 'DEF-SHELF-DEPARTMENT';
    };

    const defectiveShelfLocation = defectivePieces > 0
      ? getDefaultDefectiveShelf(fromDept)
      : null;
    const defectReason = defectivePieces > 0
      ? submittedDefectReason
      : null;
    const defectProgram = defectivePieces > 0
      ? await prisma.program.findUnique({
          where: { id: resolvedProgramId },
          select: {
            programNumber: true,
            programSerialNo: true,
            fabricColor: true,
            fabricType: true,
            fabricName: true,
          },
        })
      : null;
    const defectFirstItem = Array.isArray(body.items) ? body.items[0] : null;
    const defectColor = String(body.color || body.colour || defectFirstItem?.colour || defectFirstItem?.color || defectFirstItem?.shade || '').trim() || defectProgram?.fabricColor || null;
    const defectFabricType = String(body.fabricType || defectFirstItem?.fabricType || defectFirstItem?.fabric || defectFirstItem?.fabricCode || '').trim() || defectProgram?.fabricType || defectProgram?.fabricName || null;
    if (defectivePieces > 0 && (!defectColor || !defectFabricType)) {
      return NextResponse.json({ error: 'Color and fabric type must be recorded on the production sheet or challan before reporting a defect.' }, { status: 400 });
    }

    // 6. Prepare item rows. The required dyeing colour/quantity are stored in their own
    // columns so the receiving department never confuses them with the current shade.
    const rawItems =
      Array.isArray(body.items) && body.items.length > 0
        ? body.items
        : [
          {
            itemDescription:
              body.itemDescription || 'Production Material Lot',
            unitType: 'ROLL',
            quantity: Number(body.quantity || 1),
            uom: body.uom || 'PCS',
            remarks: body.remarks || null,
          },
        ];

    const itemRows = rawItems.map((item: any) => {
      const itemRemarks = [
        item.remarks,
        item.fabricProcessingStatus ? `Status: ${item.fabricProcessingStatus}` : null,
      ].filter(Boolean).join(' · ');
      const requiredDyeQuantity = optionalPositiveNumber(item.requiredDyeQuantity);
      return {
        itemDescription:
          item.itemDescription ||
          item.description ||
          `${item.fabric || item.fabricCode || 'Fabric'} — ${item.colour || item.color || 'Standard'}`,
        unitType: item.unitType || 'ROLL',
        quantity: Number(item.quantity ?? item.measurement ?? 1),
        uom: item.uom || item.unit || (fabricUnit === 'MIXED' ? 'MTR' : fabricUnit) || 'MTR',
        fabricCode: item.fabricCode || item.fabric || null,
        colour: item.colour || item.color || null,
        // `shade` holds the resulting / observed shade only (e.g. actual dyed colour).
        shade: item.shade || item.actualDyedColor || null,
        requiredDyeColor: String(item.requiredDyeColor || '').trim() || null,
        requiredDyeQuantity: requiredDyeQuantity !== null && Number.isFinite(requiredDyeQuantity) ? requiredDyeQuantity : null,
        size: item.size || null,
        rollNumber: item.rollNumber || null,
        remarks: itemRemarks || null,
      };
    });

    // Fabric Store issues deduct stock per fabric + colour + unit and must not exceed the balance.
    const deductsFabricStoreStock = isMovingOutFromStore && isFabricStoreDepartment(fromDept);
    if (deductsFabricStoreStock) {
      // Stock is deducted when the challan is issued; a draft would record a deduction that has not happened.
      if (body.status && body.status !== 'ISSUED') {
        return NextResponse.json({ error: 'Fabric Store challans are issued directly; draft or other initial statuses are not supported.' }, { status: 400 });
      }
      const storeLines: any[] = Array.isArray(body.items) ? body.items : [];
      if (storeLines.length === 0) {
        return NextResponse.json({ error: 'Add at least one fabric item to a Fabric Store challan.' }, { status: 400 });
      }
      const unnamedIndex = storeLines.findIndex((item) => !String(item?.fabricCode || item?.fabric || '').trim());
      if (unnamedIndex >= 0) {
        return NextResponse.json({ error: `Line ${unnamedIndex + 1}: enter the fabric name exactly as recorded in Inward Stock.` }, { status: 400 });
      }
    }
    const stockLines = deductsFabricStoreStock
      ? itemRows.map((row: (typeof itemRows)[number]) => ({
          ...challanItemStockLine(row, toDept, fabricUnit, resolvedProgram.fabricName),
          quantity: row.quantity,
        }))
      : [];

    // 7. Transactional challan creation
    const isDyeingToDyeingQcChallan = fromDept === 'DYEING' && toDept === 'DYEING_QC';
    const created = await prisma.$transaction(async (tx) => {
      if (deductsFabricStoreStock) {
        await lockFabricStoreStock(tx);
        // Re-check inside the lock: a duplicate click may have committed while we waited.
        const duplicate = await tx.challan.findFirst({
          where: { challanNumber: { equals: challanNumber, mode: 'insensitive' } },
          select: { id: true },
        });
        if (duplicate) throw new ChallanRequestError('DUPLICATE', 409);
        const ledger = await loadFabricStockLedger(tx);
        const shortages = findFabricStockShortages(ledger, stockLines);
        if (shortages.length > 0) {
          throw new ChallanRequestError(
            `Insufficient Fabric Store stock. ${describeFabricStockShortages(shortages)}.`,
            400,
            { stockShortages: shortages }
          );
        }
      }

      const challan = await tx.challan.create({
        data: {
          challanNumber,
          challanType: body.challanType || (defectivePieces > 0 && fabricOut === 0 ? 'DEFECT_RETURN' : 'INTER_DEPARTMENT'),
          programId: resolvedProgramId,
          parentChallanId: body.parentChallanId || detectedFromChallanId || null,
          fromDepartment: fromDept,
          toDepartment: toDept,
          status: body.status || 'ISSUED',
          priority: body.priority || 'NORMAL',
          createdById: actorId,
          issuedById: actorId,
          issuedDate,
          deliveryDate,
          fabricIn,
          fabricOut,
          fabricUnit,
          defectivePieces,
          defectiveShelfLocation,
          defectReason,
          detectedFromChallanId,
          detectedFromDepartment: detectedFromDept,
          remarks:
            [
              body.remarks,
              defectivePieces > 0
                ? `[DEFECT ISOLATION: ${defectivePieces} ${fabricUnit} cut & routed to ${defectiveShelfLocation} (Reason: ${defectReason}). Net Out: ${fabricOut} ${fabricUnit}]`
                : null,
              detectedFromDept
                ? `[Auto-detected from ${detectedFromDept}: In ${fabricIn ?? '—'} ${fabricUnit}]`
                : null,
              body.vehicleNumber ? `Vehicle: ${body.vehicleNumber}` : null,
              body.driverName ? `Driver: ${body.driverName}` : null,
            ]
              .filter(Boolean)
              .join(' | ') || null,
        },
      });

      // Create one canonical department shelf entry linked to the source challan.
      if (defectivePieces > 0) {
        const departmentCode = fromDept;
        const shelfCode = defectiveShelfLocation
          ? defectiveShelfLocation.split(' ')[0]
          : (DEFECTIVE_SHELF_INFO[departmentCode as DefectiveShelfDepartment]?.code || `DEF-SHELF-${departmentCode}`);
        const createdDefect = await tx.defectRecord.create({
          data: {
            defectCode: `DEF-${departmentCode}-${Date.now().toString().slice(-6)}`,
            programId: resolvedProgramId,
            productionSheetNumber: defectProgram?.programSerialNo || defectProgram?.programNumber,
            challanId: challan.id,
            departmentCode,
            shelfCode,
            color: defectColor,
            fabricType: defectFabricType,
            quantityUnit: fabricUnit,
            responsibleIncharge: defectReporterName,
            itemDescription: String(body.itemDescription || defectFirstItem?.itemDescription || '').trim() || `Defective material reported from ${departmentCode}`,
            severity: 'MAJOR',
            quantity: defectivePieces,
            reason: defectReason || submittedDefectReason || 'Defective material isolated during process',
            detectedById: defectReporterId,
            status: 'OPEN',
            resolutionNotes: `Quarantined on ${shelfCode}; disposition requires authorized workflow.`,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: defectReporterId,
            action: 'DEFECT_SHELF_ENTRY_CREATED',
            entity: 'DefectRecord',
            entityId: createdDefect.id,
            afterState: JSON.stringify({ departmentCode, shelfCode, quantity: defectivePieces, quantityUnit: fabricUnit, reason: defectReason, challanId: challan.id }),
          },
        });
      }

      for (const row of itemRows) {
        await tx.challanItem.create({
          data: { challanId: challan.id, ...row },
        });
      }

      if (deductsFabricStoreStock) {
        const ledgerAfter = await loadFabricStockLedger(tx);
        await recordStockMovements(tx, ledgerAfter, actorId, stockLines.map((line: (typeof stockLines)[number]) => ({
          entryType: 'ISSUE' as const,
          line,
          quantity: -line.quantity,
          referenceType: 'CHALLAN',
          referenceId: challan.id,
          programId: resolvedProgramId,
          notes: `Challan ${challanNumber} → ${toDept}`,
        })));
      }

      // Update linked program status
      try {
        await tx.program.update({
          where: { id: resolvedProgramId },
          data: { status: 'ISSUED' },
        });
      } catch (progErr) {
        console.warn('Program status update skipped:', progErr);
      }

      return challan;
    }, isDyeingToDyeingQcChallan || deductsFabricStoreStock ? { maxWait: 15000, timeout: 30000 } : undefined);

    // If dispatched to Dyeing, immediately sync to DyeingOrders
    // 6. Sync inbound challans to DyeingOrders once when sent to Dyeing
    if (toDept === 'DYEING' || toDept.includes('DYE')) {
      try {
        await syncInboundChallansToDyeingOrders();
      } catch (syncErr) {
        console.warn('Auto-sync to Dyeing notification:', syncErr);
      }
    }

    // 8. Return the complete challan
    const fullChallan = await prisma.challan.findUnique({
      where: { id: created.id },
      include: {
        program: true,
        items: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        dyeingInboundOrders: true,
      },
    });

    return NextResponse.json(fullChallan, { status: 201 });
  } catch (error: any) {
    if (isDuplicateChallanNumberError(error) || (error instanceof ChallanRequestError && error.message === 'DUPLICATE')) {
      return duplicateChallanNumberResponse(challanNumber);
    }
    if (error instanceof ChallanRequestError) {
      return NextResponse.json({ error: error.message, ...error.details }, { status: error.status });
    }
    console.error('Error creating challan:', error);

    return NextResponse.json(
      { error: error.message || 'Failed to create challan' },
      { status: 500 }
    );
  }
}
