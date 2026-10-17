import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

async function getFabricAvailability(
  fabricName: string,
  fabricColor: string,
  requiredMeters: number,
) {
  const rolls = await prisma.fabricStoreRoll.findMany({
    where: {
      status: 'IN_STOCK',
      qcStatus: 'PASSED',
      batch: {
        is: {
          fabricDescription: { equals: fabricName, mode: 'insensitive' },
          ...(fabricColor
            ? { colorName: { equals: fabricColor, mode: 'insensitive' } }
            : {}),
        },
      },
    },
    select: { length: true },
  });
  const availableMeters = rolls.reduce((total, roll) => total + Number(roll.length), 0);

  return {
    fabricName,
    fabricColor: fabricColor || null,
    availableMeters,
    requiredMeters,
    matchingRollCount: rolls.length,
    sufficient: availableMeters >= requiredMeters,
  };
}

function parseSafeDate(val: any, fallback?: Date | null): Date | null {
  if (!val) return fallback !== undefined ? fallback : null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? (fallback !== undefined ? fallback : null) : val;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return fallback !== undefined ? fallback : null;

    // Handle DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
      if (!isNaN(d.getTime())) return d;
    }

    // Handle YYYY-MM-DD
    const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
      if (!isNaN(d.getTime())) return d;
    }

    // Fallback to standard Date parsing
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return fallback !== undefined ? fallback : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fabricName = searchParams.get('fabricName')?.trim() || '';
  const fabricColor = searchParams.get('fabricColor')?.trim() || '';
  const fabricAverage = Number(searchParams.get('fabricAverage'));
  const productionQuantity = Number(searchParams.get('productionQuantity'));

  if (!fabricName || !Number.isFinite(fabricAverage) || fabricAverage <= 0 ||
      !Number.isInteger(productionQuantity) || productionQuantity <= 0) {
    return NextResponse.json(
      { error: 'Fabric name, meters per piece, and a positive production quantity are required.' },
      { status: 400 },
    );
  }

  try {
    const availability = await getFabricAvailability(
      fabricName,
      fabricColor,
      fabricAverage * productionQuantity,
    );
    return NextResponse.json(availability);
  } catch (error: any) {
    console.error('Error checking fabric availability:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check Fabric Store availability.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const targetStatus = data.status || 'DRAFT';
    const fabricName = String(data.fabricName || data.fabric || '').trim();
    const fabricAverage = Number(data.fabricAverage);
    const productionQuantity = Number(data.targetQuantity || data.colorQuantity);

    if (targetStatus === 'READY_FOR_ISSUE') {
      if (!fabricName || !Number.isFinite(fabricAverage) || fabricAverage <= 0 ||
          !Number.isInteger(productionQuantity) || productionQuantity <= 0) {
        return NextResponse.json(
          { error: 'Enter the fabric name, fabric average in meters per piece, and production quantity before marking the sheet ready.' },
          { status: 400 },
        );
      }

      // Note: Store inventory stock check bypass is active per user instruction.
      // Production sheet is allowed to move to next department even when store has 0 stock.
      // Strict stock gating will be re-enabled later once stock management is maintained.
    }

    // Check if updating an existing program by ID
    let existing: any = null;
    if (data.id) {
      existing = await prisma.program.findUnique({
        where: { id: data.id },
        select: { id: true, programNumber: true },
      });
    }

    // Determine unique programNumber
    let programNumber = data.programNumber;
    if (existing) {
      programNumber = existing.programNumber;
    } else if (programNumber) {
      // Check if user-provided programNumber already exists
      const conflict = await prisma.program.findUnique({
        where: { programNumber },
        select: { id: true },
      });
      if (conflict) {
        existing = conflict;
      }
    } else if (data.programSerialNo) {
      // If user typed a serial number, see if it can be used as programNumber
      const conflict = await prisma.program.findUnique({
        where: { programNumber: data.programSerialNo },
        select: { id: true },
      });
      if (!conflict) {
        programNumber = data.programSerialNo;
      }
    }

    // If still no programNumber, generate a guaranteed-unique one
    if (!programNumber) {
      const year = new Date().getFullYear();
      const prefix = `PRG-${year}-`;
      const count = await prisma.program.count({
        where: { programNumber: { startsWith: prefix } },
      });
      let candidateNumber = `${prefix}${String(count + 1).padStart(5, '0')}`;
      let conflict = await prisma.program.findUnique({
        where: { programNumber: candidateNumber },
        select: { id: true },
      });
      let inc = 1;
      while (conflict) {
        inc++;
        candidateNumber = `${prefix}${String(count + inc).padStart(5, '0')}`;
        conflict = await prisma.program.findUnique({
          where: { programNumber: candidateNumber },
          select: { id: true },
        });
      }
      programNumber = candidateNumber;
    }

    // Find default programmer user or admin guaranteed in the database
    let user = await prisma.user.findFirst({
      where: { OR: [{ username: 'programmer' }, { username: 'admin' }] },
      select: { id: true },
    });
    if (!user) {
      user = await prisma.user.findFirst({ select: { id: true } });
    }
    if (!user) {
      user = await prisma.user.create({
        data: {
          username: 'programmer',
          email: 'programmer@subhamfabrics.com',
          fullName: 'Programming Incharge',
          passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
          departmentCode: 'PROGRAMMING',
        },
        select: { id: true },
      });
    }
    const actorId = user.id;

    // Safe dates
    const startDate = parseSafeDate(data.startDate, new Date()) || new Date();
    const deliveryDate = parseSafeDate(data.deliveryDate, new Date(Date.now() + 14 * 86400000)) || new Date(Date.now() + 14 * 86400000);
    const prodDesignDate = parseSafeDate(data.productionDesignDate, null);
    const prodEndDate = parseSafeDate(data.productionEndDate, null);
    // Multi-Item, Multi-Color & Production Grid handling
    const rawItems: any[] = Array.isArray(data.items) ? data.items.filter((it: any) => it && (it.itemName || it.color || Number(it.measurement) > 0)) : [];
    const rawGrid: any[] = Array.isArray(data.productionGrid) ? data.productionGrid.filter((it: any) => it && (it.color || Number(it.pcs) > 0)) : [];

    const rawSubStylesWithAverages: any[] = Array.isArray(data.subStylesWithAverages) ? data.subStylesWithAverages : [];
    const subStylesSum = rawSubStylesWithAverages.reduce((acc: number, it: any) => acc + (Number(it.average) || 0), 0);
    const resolvedAverage = subStylesSum > 0 
      ? Math.round(subStylesSum * 100) / 100 
      : (data.fabricAverage ? parseFloat(data.fabricAverage) : 1.25);

    const gridTotalPcs = rawGrid.reduce((acc: number, it: any) => acc + (Number(it.pcs) || 0), 0);
    const itemsTotalQty = rawItems.reduce((acc: number, it: any) => acc + (Number(it.measurement) || 0), 0);
    
    const targetQty = gridTotalPcs > 0
      ? Math.round(gridTotalPcs)
      : itemsTotalQty > 0 
        ? Math.round(itemsTotalQty) 
        : Math.max(1, Math.round(Number(data.targetQuantity || data.colorQuantity || 1)));

    const uniqueGridColors = Array.from(new Set(rawGrid.map((it: any) => String(it.color || '').trim()).filter(Boolean)));
    const uniqueItemColors = Array.from(new Set(rawItems.map((it: any) => String(it.color || '').trim()).filter(Boolean)));
    const primaryColor = uniqueGridColors.length > 0
      ? uniqueGridColors.join(', ')
      : uniqueItemColors.length > 0 
        ? uniqueItemColors.join(', ') 
        : (data.fabricColor || data.color || null);

    // Prepare metadata with items & sub styles with averages
    const metadataObj: any = {};
    try {
      if (typeof data.metadataJson === 'string') {
        Object.assign(metadataObj, JSON.parse(data.metadataJson));
      } else if (data.metadataJson && typeof data.metadataJson === 'object') {
        Object.assign(metadataObj, data.metadataJson);
      }
    } catch {}

    const rawSubStyles: string[] = rawSubStylesWithAverages.length > 0
      ? rawSubStylesWithAverages.map((s: any) => String(s.name).trim()).filter(Boolean)
      : Array.isArray(data.subStyles) 
        ? data.subStyles.map((s: any) => String(s).trim()).filter(Boolean)
        : (typeof data.subStyle === 'string' ? data.subStyle.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
    const subStyleFormatted = rawSubStyles.length > 0 ? rawSubStyles.join(', ') : (data.subStyle || null);

    metadataObj.items = rawItems;
    metadataObj.subStyles = rawSubStyles;
    metadataObj.subStylesWithAverages = rawSubStylesWithAverages;
    metadataObj.productionGrid = rawGrid;
    metadataObj.topName = data.topName || data.mainStyle || '';
    metadataObj.serialNoCounter = data.serialNoCounter || '000';
    metadataObj.note = data.note || data.comments || data.remarks || '';
    metadataObj.clientCode = data.clientCode ? String(data.clientCode).trim() : (metadataObj.clientCode || '');
    metadataObj.clientPriority = data.clientPriority || data.priority || 'NORMAL';
    metadataObj.swatches = Array.isArray(data.swatches) ? data.swatches : [];

    // Store multi-component sheets (TOP, BOTTOM, DUPATTA), forwarded list, and Wilcom design entries
    if (data.components && typeof data.components === 'object') {
      metadataObj.components = data.components;
    }
    if (Array.isArray(data.forwardedComponents)) {
      metadataObj.forwardedComponents = data.forwardedComponents;
    }
    if (Array.isArray(data.wilcomEntries)) {
      metadataObj.wilcomEntries = data.wilcomEntries;
    }

    // Resolve primary wilcom information from wilcomEntries if provided
    const primaryWilcom = Array.isArray(data.wilcomEntries) && data.wilcomEntries.length > 0 
      ? data.wilcomEntries[0] 
      : null;
    const resolvedWilcomNumber = primaryWilcom?.wilcomDesignNumber || data.wilcomDesignNumber || null;
    const resolvedWilcomPhoto = primaryWilcom?.photoUrl || data.wilcomDesignPhoto || null;

    const programData = {
      programNumber,
      programSerialNo: data.programSerialNo || programNumber,
      programDate: startDate,
      startDate,
      deliveryDate,
      designNumber: data.designNumber || '',
      clientName: data.clientName || data.buyerName || '',
      buyerName: data.clientName || data.buyerName || '',
      clientPriority: data.clientPriority || data.priority || 'NORMAL',
      priority: data.clientPriority || data.priority || 'NORMAL',
      orderNumber: data.orderNumber || (data.programSerialNo ? `ORD-${data.programSerialNo}` : (programNumber ? `ORD-${programNumber}` : '')),
      designName: data.embroideryDesign || data.designName || '',
      styleCode: data.mainStyle || data.styleCode || data.topName || '',
      productCategory: data.productCategory || 'GARMENT',
      targetQuantity: targetQty,
      status: targetStatus,
      remarks: data.note || data.comments || data.remarks || null,
      createdById: actorId,

      // Style Info
      mainStyle: data.mainStyle || data.topName || null,
      subStyle: subStyleFormatted,
      pattern: data.pattern || null,
      baseDesignType: data.baseDesignType || null,
      baseDesignPhoto: data.baseDesignPhoto || null,

      // Wilcom Info
      wilcomDesignNumber: resolvedWilcomNumber,
      wilcomDesignPhoto: resolvedWilcomPhoto,
      embroideryDesign: resolvedWilcomNumber || data.embroideryDesign || null,
      embroideryDesignSize: data.embroideryDesignSize || null,

      // Fabric Info
      fabricName: data.fabricName || data.fabric || null,
      fabricType: data.fabricType || null,
      fabricWidth: data.fabricWidth || null,
      fabricWidthInches: data.fabricWidthInches ? parseFloat(data.fabricWidthInches) : null,
      fabricColor: primaryColor,
      fabricColorAvailable: data.fabricColorAvailable || null,
      fabricAverage: resolvedAverage,
      fabricAverageType: data.fabricAverageType || 'Meters/Piece',
      fabricAverageMeasurement: data.fabricAverageMeasurement || null,

      // Dyeing Info
      fabricDyeingRequired: Boolean(data.fabricDyeingRequired),
      fabricIssuedToDyeing: data.fabricIssuedToDyeing ? parseFloat(data.fabricIssuedToDyeing) : null,
      fabricSentToDyeing: data.fabricSentToDyeing ? parseFloat(data.fabricSentToDyeing) : null,

      // Quantity Info
      colorQuantity: targetQty,
      quantityMeasurement: data.quantityMeasurement || rawItems[0]?.unit || 'PCS',
      specialMaterial: data.specialMaterial || rawItems[0]?.specialMaterial || null,
      specialMaterialQuantity: data.specialMaterialQuantity || null,

      // Dates & Rejection
      productionDesignDate: prodDesignDate,
      productionEndDate: prodEndDate,
      piecesRejection: data.piecesRejection ? parseInt(data.piecesRejection, 10) : 0,
      rejectionReason: data.rejectionReason || null,
      comments: data.note || data.comments || null,
      metadataJson: JSON.stringify(metadataObj),
    };

    const program = await prisma.$transaction(async (tx) => {
      let created;
      if (existing) {
        created = await tx.program.update({
          where: { id: existing.id },
          data: programData,
        });
        await tx.programFabric.deleteMany({ where: { programId: existing.id } });
        await tx.programColour.deleteMany({ where: { programId: existing.id } });
        await tx.programSize.deleteMany({ where: { programId: existing.id } });
      } else {
        created = await tx.program.create({
          data: programData,
        });
      }

      // Auto-populate ProgramFabric
      if (data.fabricName || data.fabric) {
        const fabName = data.fabricName || data.fabric;
        const avg = resolvedAverage;
        const requiredQty = targetQty * avg;
        await tx.programFabric.create({
          data: {
            programId: created.id,
            fabricCode: fabName.toUpperCase().replace(/\s+/g, '-').slice(0, 50),
            fabricName: fabName,
            composition: data.fabricType || 'Cotton Cambric',
            widthInInches: parseFloat(data.fabricWidthInches) || 58.0,
            gsm: 180,
            colour: primaryColor || 'Standard',
            requiredQuantity: requiredQty,
            uom: 'MTR',
          },
        });
      }

      // Auto-populate ProgramColour from productionGrid, rawItems, or single color
      if (rawGrid.length > 0) {
        const colorMap: Record<string, number> = {};
        for (const it of rawGrid) {
          const c = String(it.color || '').trim() || 'Standard';
          colorMap[c] = (colorMap[c] || 0) + (Number(it.pcs) || 0);
        }
        for (const [cName, cQty] of Object.entries(colorMap)) {
          await tx.programColour.create({
            data: {
              programId: created.id,
              colorCode: cName.substring(0, 4).toUpperCase().replace(/\s+/g, ''),
              colorName: cName,
              targetQuantity: Math.max(1, Math.round(cQty)),
            },
          });
        }
      } else if (rawItems.length > 0) {
        const colorMap: Record<string, number> = {};
        for (const it of rawItems) {
          const c = String(it.color || '').trim() || 'Standard';
          colorMap[c] = (colorMap[c] || 0) + (Number(it.measurement) || 0);
        }
        for (const [cName, cQty] of Object.entries(colorMap)) {
          await tx.programColour.create({
            data: {
              programId: created.id,
              colorCode: cName.substring(0, 4).toUpperCase().replace(/\s+/g, ''),
              colorName: cName,
              targetQuantity: Math.max(1, Math.round(cQty)),
            },
          });
        }
      } else if (data.fabricColor || data.color) {
        const cName = data.fabricColor || data.color;
        await tx.programColour.create({
          data: {
            programId: created.id,
            colorCode: cName.substring(0, 3).toUpperCase(),
            colorName: cName,
            targetQuantity: targetQty,
          },
        });
      }

      // Auto-populate ProgramSize
      await tx.programSize.create({
        data: {
          programId: created.id,
          size: data.fabricWidth ? String(data.fabricWidth) : 'FREE',
          targetQuantity: targetQty,
        },
      });

      return created;
    });

    const fullProgram = await prisma.program.findUnique({
      where: { id: program.id },
      include: {
        fabrics: true,
        colours: true,
        sizes: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
      },
    });

    const cookieHeader = request.headers.get('cookie') || '';
    const deptHeader = request.headers.get('x-user-department') || '';
    const roleHeader = request.headers.get('x-user-role') || '';

    const isAuthorized = 
      deptHeader.toUpperCase() === 'ADMIN' ||
      deptHeader.toUpperCase() === 'PROGRAMMING' ||
      roleHeader.toUpperCase() === 'ADMIN' ||
      roleHeader.toUpperCase() === 'SUPER_ADMIN' ||
      roleHeader.toUpperCase() === 'PROGRAMMER' ||
      roleHeader.toUpperCase() === 'PROGRAMMING_INCHARGE' ||
      cookieHeader.includes('subham_mes_dept=ADMIN') ||
      cookieHeader.includes('subham_mes_dept=PROGRAMMING') ||
      cookieHeader.includes('subham_mes_role=ADMIN') ||
      cookieHeader.includes('subham_mes_role=SUPER_ADMIN') ||
      cookieHeader.includes('subham_mes_role=PROGRAMMER');

    let sanitizedProgram: any = { ...fullProgram };
    if (!isAuthorized) {
      sanitizedProgram.clientCode = null;
      if (sanitizedProgram.metadataJson) {
        try {
          const parsed = JSON.parse(sanitizedProgram.metadataJson);
          delete parsed.clientCode;
          sanitizedProgram.metadataJson = JSON.stringify(parsed);
        } catch {}
      }
    } else {
      sanitizedProgram.clientCode = metadataObj.clientCode || null;
    }

    return NextResponse.json(sanitizedProgram, { status: 201 });
  } catch (error: any) {
    console.error('Error creating production sheet:', error);
    return NextResponse.json({ error: error.message || 'Failed to create production sheet' }, { status: 500 });
  }
}
