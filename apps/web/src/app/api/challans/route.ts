
import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { syncInboundChallansToDyeingOrders } from '@/lib/dyeing-sync';
import { requireUser } from '@/lib/auth/require-user';
import { canStoreChallanAverage, canWriteColumns } from '@/lib/challan-item-average';
import { userBelongsToDepartment } from '@/lib/auth/department-access';
import { workflowIssuing } from '@/lib/work-items-server';
import {
  assertChallanNumbersAvailable,
  challanNumberErrorResponse,
  requireChallanNumber,
} from '@/lib/challan-number-server';
import {
  FabricStockError,
  STOCK_TRANSACTION_OPTIONS,
  fabricStockErrorBody,
  syncChallanStock,
} from '@/lib/fabric-stock-ledger';
import { storeDyeingItemFields } from '@/lib/dyeing-instructions.mjs';
import {
  MIXED_UNIT,
  QUANTITY_UNITS,
  challanTotalsByUnit,
  formatTotals,
  headerUnitOf,
  totalsByUnit,
  unitOf,
} from '@/lib/challan-units.mjs';

const CHALLAN_CREATE_ENDPOINT = 'POST /api/challans';

function loadCreatedChallan(id: string) {
  return prisma.challan.findUnique({
    where: { id },
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
}

/**
 * The challan created by an earlier request with the same idempotency key, if any. The key is
 * recorded in the same transaction as the challan, so a concurrent duplicate that loses the race
 * on the challan number finds it here once the winner commits.
 */
async function replayIdempotentRequest(key: string | null) {
  if (!key) return null;
  const record = await prisma.idempotencyRecord.findUnique({ where: { key } });
  if (!record || record.endpoint !== CHALLAN_CREATE_ENDPOINT) return null;
  const { challanId } = JSON.parse(record.responseBody) as { challanId?: string };
  const challan = challanId ? await loadCreatedChallan(challanId) : null;
  if (!challan) return null;
  return NextResponse.json(challan, { status: record.statusCode, headers: { 'Idempotent-Replay': 'true' } });
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

/** A line's optional Average: null when blank, undefined when it is not a number of zero or more. */
function averageOf(item: any): number | null | undefined {
  const raw = item?.average;
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
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
  const { user: authUser, response: authResponse } = await requireUser(request);
  if (!authUser) return authResponse;
  let challanNumber = '';
  let idempotencyKey: string | null = null;
  try {
    const body = await request.json();

    // A retried or double-submitted request returns the challan the first one created.
    const rawKey = request.headers.get('Idempotency-Key') || body.idempotencyKey;
    idempotencyKey = rawKey ? `${CHALLAN_CREATE_ENDPOINT}:${authUser.id}:${String(rawKey).slice(0, 128)}` : null;
    const replay = await replayIdempotentRequest(idempotencyKey);
    if (replay) return replay;

    // The challan number is typed by the issuing department and saved exactly as entered.
    challanNumber = requireChallanNumber(body.challanNumber);

    // 1. The issuing user is always the signed-in user
    const actorId = authUser.id;

    // 2. Resolve Program ID reliably
    let resolvedProgramId = body.programId;

    if (resolvedProgramId) {
      const prog = await prisma.program.findFirst({
        where: {
          OR: [
            { id: resolvedProgramId },
            { programNumber: resolvedProgramId },
            { programSerialNo: resolvedProgramId },
          ],
        },
        select: { id: true },
      });

      if (prog) {
        resolvedProgramId = prog.id;
      } else {
        return NextResponse.json(
          { error: `Production sheet ${resolvedProgramId} was not found.` },
          { status: 400 }
        );
      }
    } else {
      const firstProg = await prisma.program.findFirst({
        select: { id: true },
      });

      if (firstProg) resolvedProgramId = firstProg.id;
    }

    if (!resolvedProgramId) {
      return NextResponse.json(
        {
          error:
            'Cannot issue challan without an active Program in the database.',
        },
        { status: 400 }
      );
    }

    // 3. Ensure departments exist in the Department table
    const fromDept = (body.fromDepartment || 'PROGRAMMING').toUpperCase();
    const toDept = (body.toDepartment || 'STORE').toUpperCase();

    // Dyeing -> Dyeing QC challans move dyed quantities and must go through the Dyeing endpoint,
    // which checks and records what each line transfers.
    if (fromDept === 'DYEING' && toDept === 'QC1') {
      return NextResponse.json(
        { error: 'Issue Dyeing to Dyeing QC challans from Dyeing > My Work > Issue Challan to Dyeing QC.' },
        { status: 400 },
      );
    }
    // Same for work-item departments (lib/work-items-server: transferred quantities per line),
    // e.g. Embroidery -> Thread Cutting, Thread Cutting -> Threadcut QC, Threadcut QC -> Washing.
    const issuingScreen = workflowIssuing(fromDept, toDept);
    if (issuingScreen) {
      return NextResponse.json({ error: `Issue this challan from ${issuingScreen}.` }, { status: 400 });
    }

    // A department may only issue challans from itself.
    if (!userBelongsToDepartment(authUser, fromDept)) {
      return NextResponse.json(
        { error: `You can only issue challans from your own department, not from ${fromDept}.` },
        { status: 403 }
      );
    }

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
      // Each unit on the challan is checked against stock in that same unit; MTR and PCS never mix.
      const requestedUnits = Array.from(new Set(
        (Array.isArray(body.items) ? body.items : [])
          .map((item: any) => unitOf(item?.uom || item?.unit))
          .filter(Boolean)
      )) as Array<'MTR' | 'PCS'>;
      if (requestedUnits.length === 0 && unitOf(body.fabricUnit)) requestedUnits.push(unitOf(body.fabricUnit) as 'MTR' | 'PCS');
      for (const unitOverride of requestedUnits.length ? requestedUnits : [undefined]) {
        const availability = await checkFabricStoreAvailability(resolvedProgramId, unitOverride);
        if (!availability.isAvailable) {
          return NextResponse.json(
            {
              error: `Fabric is not available in Fabric Store for Program ${availability.programSerialNo || resolvedProgramId}. ${availability.message}`,
              fabricAvailability: availability,
            },
            { status: 400 }
          );
        }
      }
    }

    // 4. The typed challan number must not be used by another challan (any letter case).
    await assertChallanNumbersAvailable(prisma, fromDept, [{ value: challanNumber }]);

    // 5. Auto-Detection of Fabric / Pieces In from Previous Department
    let detectedFabricIn: number | null = null;
    let detectedFromDept: string | null = body.detectedFromDepartment || null;
    let detectedFromChallanId: string | null = body.detectedFromChallanId || body.parentChallanId || null;
    let detectedUnit: string | null = unitOf(body.fabricUnit) || unitOf(body.uom) || null;

    if (body.parentChallanId) {
      const parent = await prisma.challan.findUnique({
        where: { id: body.parentChallanId },
        include: { items: true },
      });
      if (parent) {
        // A parent with lines in both units has no single "in" quantity; its lines carry their own.
        const pTotals = challanTotalsByUnit(parent);
        const pUnits = Object.keys(pTotals);
        if (pUnits.length <= 1) {
          detectedFabricIn = parent.fabricOut ?? (pTotals[pUnits[0]] || parent.fabricIn || 0);
          if (pUnits[0]) detectedUnit = pUnits[0];
          else if (unitOf(parent.fabricUnit)) detectedUnit = parent.fabricUnit as string;
        }
        detectedFromDept = parent.fromDepartment;
        detectedFromChallanId = parent.id;
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
        const prTotals = challanTotalsByUnit(priorChallan);
        const prUnits = Object.keys(prTotals);
        if (prUnits.length <= 1) {
          detectedFabricIn = priorChallan.fabricOut ?? (prTotals[prUnits[0]] || priorChallan.fabricIn || 0);
          if (prUnits[0]) detectedUnit = prUnits[0];
          else if (unitOf(priorChallan.fabricUnit)) detectedUnit = priorChallan.fabricUnit as string;
        }
        detectedFromDept = priorChallan.fromDepartment;
        detectedFromChallanId = priorChallan.id;
      }
    }

    // Every line has its own unit (MTR or PCS). Header quantities hold one unit, so a challan whose
    // lines use both keeps fabricUnit MIXED and leaves fabricIn/fabricOut empty: its totals are per
    // unit, from the lines. Meters and pieces are never added together or converted.
    const bodyItems: any[] = Array.isArray(body.items) ? body.items : [];
    const itemUnits = bodyItems.map((item: any) => unitOf(item?.uom || item?.unit) || String(item?.uom || item?.unit || '').toUpperCase());
    if (bodyItems.length > 0 && itemUnits.some((u) => !QUANTITY_UNITS.includes(u as any))) {
      return NextResponse.json({ error: 'Choose MTR or PCS for every item.' }, { status: 400 });
    }
    for (const [index, item] of bodyItems.entries()) {
      const qty = Number(item?.quantity ?? item?.measurement);
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json({ error: `Item ${index + 1}: enter a quantity greater than zero.` }, { status: 400 });
      }
      if (averageOf(item) === undefined) {
        return NextResponse.json({ error: `Item ${index + 1}: Average must be a number of zero or more.` }, { status: 400 });
      }
      if (averageOf(item) !== null && !unitOf(item?.averageUnit)) {
        return NextResponse.json({ error: `Item ${index + 1}: choose MTR or PCS for the Average.` }, { status: 400 });
      }
    }
    const itemUnit = headerUnitOf(itemUnits); // MTR | PCS | MIXED | null (no lines)
    const isMixed = itemUnit === MIXED_UNIT;
    const rawItemsSum = isMixed ? 0 : bodyItems.reduce((sum: number, it: any) => sum + (Number(it.quantity ?? it.measurement) || 0), 0);

    const isFabricStoreIssue = fromDept === 'STORE' &&
      (body.challanType === 'STORE_TO_DYEING' || body.challanType === 'STORE_TO_EMBROIDERY');

    const defectivePieces = Number(body.defectivePieces || 0);
    // No unit is ever assumed: it comes from the lines, the request, or the predecessor challan.
    const fabricUnit = isMixed
      ? MIXED_UNIT
      : (isFabricStoreIssue && itemUnit) || unitOf(body.fabricUnit) || detectedUnit || unitOf(body.uom) || itemUnit;
    if (!fabricUnit) {
      return NextResponse.json({ error: 'Choose MTR or PCS for the challan quantity.' }, { status: 400 });
    }
    // The defective quantity is in the unit chosen for it (the tracking unit), never the MIXED header.
    const defectiveUnit = defectivePieces > 0
      ? unitOf(body.defectiveUnit) || unitOf(body.fabricUnit) || unitOf(fabricUnit) || null
      : null;
    if (defectivePieces > 0 && !defectiveUnit) {
      return NextResponse.json({ error: 'Choose MTR or PCS for the defective quantity.' }, { status: 400 });
    }
    if (isFabricStoreIssue && defectivePieces > 0 && itemUnit && !itemUnits.includes(defectiveUnit as string)) {
      return NextResponse.json({ error: 'The defective quantity must be in a unit used by the challan items.' }, { status: 400 });
    }
    const hasMeasuredStoreItems = isFabricStoreIssue && Boolean(itemUnit) && !isMixed && rawItemsSum > 0;
    // Defects are counted into "in" only when they share the items' unit.
    const defectInItemUnit = defectiveUnit && defectiveUnit === (itemUnit || unitOf(fabricUnit)) ? defectivePieces : 0;

    const fabricIn = isMixed
      ? null
      : hasMeasuredStoreItems
      ? rawItemsSum + defectInItemUnit
      : body.fabricIn !== undefined && body.fabricIn !== null && body.fabricIn !== ''
        ? Number(body.fabricIn)
        : (detectedFabricIn ?? (rawItemsSum || Number(body.quantity || 1)));

    const fabricOut = isMixed
      ? null
      : hasMeasuredStoreItems
      ? rawItemsSum
      : body.fabricOut !== undefined && body.fabricOut !== null && body.fabricOut !== ''
        ? Number(body.fabricOut)
        : Math.max(0, (fabricIn ?? 0) - defectInItemUnit);
    const outText = fabricOut === null ? formatTotals(totalsByUnit(bodyItems, null, (it) => it.quantity ?? it.measurement)) : `${fabricOut} ${fabricUnit}`;
    const getDefaultDefectiveShelf = (dept: string) => {
      const up = dept.toUpperCase();
      if (up.includes('QC1') || up.includes('DYEING QC') || up.includes('DYE QC'))
        return 'DEF-SHELF-QC1 (Dyeing QC Defective Shelf)';
      if (up.includes('DYE')) return 'DEF-SHELF-DYEING (Dyeing Station Defective Shelf)';
      if (up.includes('EMB')) return 'DEF-SHELF-EMBROIDERY (Embroidery Station Defective Shelf)';
      if (up.includes('QC2') || up.includes('THREAD CUT QC') || up.includes('THREAD CUTTING QC'))
        return 'DEF-SHELF-QC2 (Threadcut QC Defective Shelf)';
      if (up.includes('THREAD') || up.includes('CUTTING') || up.includes('THC'))
        return 'DEF-SHELF-THREAD-CUTTING (Thread Cutting Trimming Shelf)';
      if (up.includes('QC3') || up.includes('WASHING QC') || up.includes('WASH QC'))
        return 'DEF-SHELF-QC3 (Washing QC Defective Shelf)';
      if (up.includes('FINAL') || up.includes('FINAL_CHECK') || up.includes('FINAL CHECK'))
        return 'DEF-SHELF-FINAL-CHECK (Final check Defective Shelf)';
      return 'DEF-SHELF-STORE (Fabric Store Quarantined Shelf)';
    };

    const defectiveShelfLocation = defectivePieces > 0
      ? (body.defectiveShelfLocation || getDefaultDefectiveShelf(fromDept))
      : null;
    const defectReason = defectivePieces > 0
      ? (body.defectReason || 'Quality Defect / In-Process Segregation')
      : null;

    // 6. Transactional challan creation
    const isDyeingToQc1Challan = fromDept === 'DYEING' && toDept === 'QC1';
    const isStoreOutward = (fromDept === 'STORE' || fromDept.includes('FABRIC')) && toDept !== 'STORE';
    // A line's Average is saved once the database and the loaded client both have the column;
    // until then the challan is still issued, just without it.
    const storeAverage = await canStoreChallanAverage();
    // The incharge's name as typed on the form. Saved in its own column once it exists; until then it
    // is kept as an "Incharge:" note in the remarks (hidden from displayed remarks, read by inchargeNameOf).
    const inchargeName = typeof body.inchargeName === 'string' ? body.inchargeName.trim().slice(0, 100) : '';
    const storeInchargeColumn = inchargeName ? await canWriteColumns('Challan', ['inchargeName']) : false;

    const created = await prisma.$transaction(async (tx) => {
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
          issuedDate: parseSafeDate(body.issuedDate, new Date()) || new Date(),
          fabricIn,
          fabricOut,
          fabricUnit,
          defectivePieces,
          defectiveUnit,
          defectiveShelfLocation,
          defectReason,
          detectedFromChallanId,
          detectedFromDepartment: detectedFromDept,
          ...(storeInchargeColumn ? { inchargeName } : {}),
          remarks:
            // What the user typed only: the defect, its shelf and the in/out quantities have their own fields.
            [
              body.remarks,
              body.vehicleNumber ? `Vehicle: ${body.vehicleNumber}` : null,
              body.driverName ? `Driver: ${body.driverName}` : null,
              inchargeName && !storeInchargeColumn ? `Incharge: ${inchargeName}` : null,
            ]
              .filter(Boolean)
              .join(' | ') || null,
        },
      });

      // If defective pieces cut, create DefectRecord for full audit trail & defective shelf tracking
      if (defectivePieces > 0) {
        try {
          await tx.defectRecord.create({
            data: {
              defectCode: `DEF-${fromDept}-${Date.now().toString().slice(-4)}`,
              programId: resolvedProgramId,
              challanId: challan.id,
              departmentCode: fromDept,
              itemDescription: `Defective pieces cut in ${fromDept} — Quarantined on ${defectiveShelfLocation}`,
              severity: 'MAJOR',
              quantity: defectivePieces,
              uom: defectiveUnit,
              reason: defectReason || 'Defective piece cut during department processing',
              detectedById: actorId,
              status: 'OPEN',
              resolutionNotes: `Defective ${defectivePieces} ${defectiveUnit} segregated to ${defectiveShelfLocation}. Leftover ${outText} dispatched to ${toDept}.`,
            },
          });
        } catch (defectErr) {
          console.warn('Defect record creation note:', defectErr);
        }
      }

      // Prepare items
      const rawItems =
        Array.isArray(body.items) && body.items.length > 0
          ? body.items
          : [
            {
              itemDescription:
                body.itemDescription || 'Production Material Lot',
              unitType: 'ROLL',
              quantity: Number(body.quantity || 1),
              uom: unitOf(body.uom) || fabricUnit,
              remarks: body.remarks || null,
            },
          ];

      for (const item of rawItems) {
        // Current colour/shade and the colour Dyeing must achieve are kept apart, per line.
        const colourFields = storeDyeingItemFields(item);
        const itemRemarks = [
          item.remarks,
          item.actualDyedColor ? `Actual Dyed Color: ${item.actualDyedColor}` : null,
          item.fabricProcessingStatus ? `Status: ${item.fabricProcessingStatus}` : null,
        ].filter(Boolean).join(' · ');

        await tx.challanItem.create({
          data: {
            challanId: challan.id,
            itemDescription:
              item.itemDescription ||
              item.description ||
              `${item.fabric || item.fabricCode || 'Fabric'} — ${item.colour || item.color || 'Standard'}`,
            unitType: item.unitType || 'ROLL',
            quantity: Number(item.quantity ?? item.measurement ?? 1),
            uom: unitOf(item.uom || item.unit) || unitOf(fabricUnit) || 'MTR',
            fabricCode: item.fabricCode || item.fabric || null,
            colour: colourFields.colour,
            shade: colourFields.shade,
            requiredColour: colourFields.requiredColour,
            requiredQuantity: colourFields.requiredQuantity,
            // Dyed / Undyed for this line, as chosen on the issuing form (e.g. Store -> Embroidery).
            fabricProcessingStatus: ['DYED', 'UNDYED'].includes(String(item.fabricProcessingStatus || '').toUpperCase())
              ? String(item.fabricProcessingStatus).toUpperCase()
              : null,
            size: item.size || null,
            rollNumber: item.rollNumber || null,
            // Only written when entered, so challans without an Average never touch the column.
            ...(storeAverage && averageOf(item) !== null
              ? { average: averageOf(item), averageUnit: unitOf(item.averageUnit) }
              : {}),
            remarks: itemRemarks || null,
          },
        });
      }

      // Fabric Store issues deduct their lines from stock (matching fabric, colour and unit) and
      // post the movement to the ledger; insufficient stock rolls the whole challan back.
      if (isStoreOutward) {
        await syncChallanStock(tx, challan.id, actorId);
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

      if (idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: {
            key: idempotencyKey,
            endpoint: CHALLAN_CREATE_ENDPOINT,
            method: 'POST',
            statusCode: 201,
            responseBody: JSON.stringify({ challanId: challan.id }),
          },
        });
      }

      return challan;
    }, isDyeingToQc1Challan || isStoreOutward ? STOCK_TRANSACTION_OPTIONS : undefined);

    // If dispatched to Dyeing, immediately sync to DyeingOrders
    // 6. Sync inbound challans to DyeingOrders once when sent to Dyeing
    if (toDept === 'DYEING' || toDept.includes('DYE')) {
      try {
        await syncInboundChallansToDyeingOrders();
      } catch (syncErr) {
        console.warn('Auto-sync to Dyeing notification:', syncErr);
      }
    }

    // 7. Return the complete challan
    const fullChallan = await loadCreatedChallan(created.id);

    return NextResponse.json(fullChallan, { status: 201 });
  } catch (error: any) {
    if (error instanceof FabricStockError) {
      return NextResponse.json(fabricStockErrorBody(error), { status: 400 });
    }
    // A concurrent duplicate of this same submission lost the race: return the winner's challan.
    const replay = await replayIdempotentRequest(idempotencyKey).catch(() => null);
    if (replay) return replay;
    const numberResponse = challanNumberErrorResponse(error, challanNumber);
    if (numberResponse) return numberResponse;
    console.error('Error creating challan:', error);

    return NextResponse.json(
      { error: error.message || 'Failed to create challan' },
      { status: 500 }
    );
  }
}
