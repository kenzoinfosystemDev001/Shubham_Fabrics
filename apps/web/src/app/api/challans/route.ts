
import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { syncInboundChallansToDyeingOrders } from '@/lib/dyeing-sync';
import { requireUser } from '@/lib/auth/require-user';
import { userBelongsToDepartment } from '@/lib/auth/department-access';
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

    // 4. The typed challan number must not be used by another challan (any letter case).
    await assertChallanNumbersAvailable(prisma, [{ value: challanNumber }]);

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
      ? new Set((Array.isArray(body.items) ? body.items : [])
          .map((item: any) => String(item?.uom || item?.unit || body.fabricUnit || 'MTR').toUpperCase()))
      : new Set<string>();
    if (isFabricStoreIssue && storeItemUnits.size > 1) {
      return NextResponse.json({ error: 'Use one stock unit (MTR or PCS) for every item in a Fabric Store challan.' }, { status: 400 });
    }
    const storeItemUnit = storeItemUnits.values().next().value as string | undefined;
    if (isFabricStoreIssue && storeItemUnit && !['MTR', 'PCS'].includes(storeItemUnit)) {
      return NextResponse.json({ error: 'Fabric Store challan items must use MTR or PCS.' }, { status: 400 });
    }

    const defectivePieces = Number(body.defectivePieces || 0);
    const fabricUnit = (isFabricStoreIssue && storeItemUnit) || body.fabricUnit || detectedUnit || body.uom || 'MTR';
    const hasMeasuredStoreItems = isFabricStoreIssue && Boolean(storeItemUnit) && rawItemsSum > 0;

    if (
      isFabricStoreIssue &&
      defectivePieces > 0 &&
      body.fabricUnit &&
      String(body.fabricUnit).toUpperCase() !== fabricUnit
    ) {
      return NextResponse.json({ error: 'The defective quantity unit must match the challan item unit.' }, { status: 400 });
    }

    const fabricIn = hasMeasuredStoreItems
      ? rawItemsSum + defectivePieces
      : body.fabricIn !== undefined && body.fabricIn !== null && body.fabricIn !== ''
        ? Number(body.fabricIn)
        : (detectedFabricIn ?? (rawItemsSum || Number(body.quantity || 1)));

    const fabricOut = hasMeasuredStoreItems
      ? rawItemsSum
      : body.fabricOut !== undefined && body.fabricOut !== null && body.fabricOut !== ''
        ? Number(body.fabricOut)
        : Math.max(0, fabricIn - defectivePieces);
    const getDefaultDefectiveShelf = (dept: string) => {
      const up = dept.toUpperCase();
      if (up.includes('QC1') || up.includes('DYEING QC') || up.includes('DYE QC'))
        return 'DEF-SHELF-QC1 (Dyeing QC Defective Shelf)';
      if (up.includes('DYE')) return 'DEF-SHELF-DYEING (Dyeing Station Defective Shelf)';
      if (up.includes('EMB')) return 'DEF-SHELF-EMBROIDERY (Embroidery Station Defective Shelf)';
      if (up.includes('QC2') || up.includes('THREAD CUT QC') || up.includes('THREAD CUTTING QC'))
        return 'DEF-SHELF-QC2 (Thread Cut QC Defective Shelf)';
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
                ? `[Auto-detected from ${detectedFromDept}: In ${fabricIn} ${fabricUnit}]`
                : null,
              body.vehicleNumber ? `Vehicle: ${body.vehicleNumber}` : null,
              body.driverName ? `Driver: ${body.driverName}` : null,
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
              quantity: Math.max(1, Math.round(defectivePieces)),
              reason: defectReason || 'Defective piece cut during department processing',
              detectedById: actorId,
              status: 'OPEN',
              resolutionNotes: `Defective ${defectivePieces} ${fabricUnit} segregated to ${defectiveShelfLocation}. Leftover ${fabricOut} ${fabricUnit} dispatched to ${toDept}.`,
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
              uom: body.uom || 'PCS',
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
            uom: item.uom || item.unit || fabricUnit || 'MTR',
            fabricCode: item.fabricCode || item.fabric || null,
            colour: colourFields.colour,
            shade: colourFields.shade,
            requiredColour: colourFields.requiredColour,
            requiredQuantity: colourFields.requiredQuantity,
            size: item.size || null,
            rollNumber: item.rollNumber || null,
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
