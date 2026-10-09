import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

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

export async function POST(request: Request) {
  try {
    const data = await request.json();

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
    const targetQty = Math.max(1, Math.round(Number(data.targetQuantity || data.colorQuantity || 1)));

    const programData = {
      programNumber,
      programSerialNo: data.programSerialNo || programNumber,
      programDate: startDate,
      startDate,
      deliveryDate,
      designNumber: data.designNumber || 'DSG-001',
      clientName: data.clientName || data.buyerName || 'Standard Client',
      buyerName: data.clientName || data.buyerName || 'Standard Client',
      clientPriority: data.clientPriority || data.priority || 'NORMAL',
      priority: data.clientPriority || data.priority || 'NORMAL',
      orderNumber: data.orderNumber || (data.programSerialNo ? `ORD-${data.programSerialNo}` : `ORD-${programNumber}`),
      designName: data.embroideryDesign || data.designName || 'Standard Embroidery',
      styleCode: data.mainStyle || data.styleCode || 'STYLE-01',
      productCategory: data.productCategory || 'GARMENT',
      targetQuantity: targetQty,
      status: data.status || 'DRAFT',
      remarks: data.comments || data.remarks || null,
      createdById: actorId,

      // Style Info
      mainStyle: data.mainStyle || null,
      subStyle: data.subStyle || null,
      pattern: data.pattern || null,
      baseDesignType: data.baseDesignType || null,
      baseDesignPhoto: data.baseDesignPhoto || null,

      // Wilcom Info
      wilcomDesignNumber: data.wilcomDesignNumber || null,
      wilcomDesignPhoto: data.wilcomDesignPhoto || null,
      embroideryDesign: data.embroideryDesign || null,
      embroideryDesignSize: data.embroideryDesignSize || null,

      // Fabric Info
      fabricName: data.fabricName || null,
      fabricType: data.fabricType || null,
      fabricWidth: data.fabricWidth || null,
      fabricWidthInches: data.fabricWidthInches ? parseFloat(data.fabricWidthInches) : null,
      fabricColor: data.fabricColor || null,
      fabricColorAvailable: data.fabricColorAvailable || null,
      fabricAverage: data.fabricAverage ? parseFloat(data.fabricAverage) : null,
      fabricAverageType: data.fabricAverageType || null,
      fabricAverageMeasurement: data.fabricAverageMeasurement || null,

      // Dyeing Info
      fabricDyeingRequired: Boolean(data.fabricDyeingRequired),
      fabricIssuedToDyeing: data.fabricIssuedToDyeing ? parseFloat(data.fabricIssuedToDyeing) : null,
      fabricSentToDyeing: data.fabricSentToDyeing ? parseFloat(data.fabricSentToDyeing) : null,

      // Quantity Info
      colorQuantity: data.colorQuantity ? parseInt(data.colorQuantity, 10) : targetQty,
      quantityMeasurement: data.quantityMeasurement || 'PCS',
      specialMaterial: data.specialMaterial || null,
      specialMaterialQuantity: data.specialMaterialQuantity || null,

      // Dates & Rejection
      productionDesignDate: prodDesignDate,
      productionEndDate: prodEndDate,
      piecesRejection: data.piecesRejection ? parseInt(data.piecesRejection, 10) : 0,
      rejectionReason: data.rejectionReason || null,
      comments: data.comments || null,
      metadataJson: JSON.stringify(data),
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
        const avg = parseFloat(data.fabricAverage) || 1.25;
        const requiredQty = Math.round(targetQty * avg);
        await tx.programFabric.create({
          data: {
            programId: created.id,
            fabricCode: fabName.toUpperCase().replace(/\s+/g, '-').slice(0, 50),
            fabricName: fabName,
            composition: data.fabricType || 'Cotton Cambric',
            widthInInches: parseFloat(data.fabricWidthInches) || 58.0,
            gsm: 180,
            colour: data.fabricColor || data.color || 'Standard',
            requiredQuantity: requiredQty,
            uom: 'KG',
          },
        });
      }

      // Auto-populate ProgramColour
      if (data.fabricColor || data.color) {
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

      // Auto-populate default ProgramSize
      await tx.programSize.create({
        data: {
          programId: created.id,
          size: 'FREE',
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

    return NextResponse.json(fullProgram, { status: 201 });
  } catch (error: any) {
    console.error('Error creating production sheet:', error);
    return NextResponse.json({ error: error.message || 'Failed to create production sheet' }, { status: 500 });
  }
}
