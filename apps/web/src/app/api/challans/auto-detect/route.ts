import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { normalizeDepartmentCode } from '@subham/types';

export const dynamic = 'force-dynamic';

// Map departments to their possible alias strings in toDepartment
const DEPT_ALIASES: Record<string, string[]> = {
  STORE: ['STORE', 'FABRIC_STORE', 'FABRIC STORE', 'RAW MATERIAL STORE'],
  FABRIC_STORE: ['STORE', 'FABRIC_STORE', 'FABRIC STORE', 'RAW MATERIAL STORE'],
  DYEING: ['DYEING', 'DYE', 'DYEING DEPARTMENT', 'DYE HOUSE'],
  DYEING_QC: ['DYEING_QC', 'QC_1', 'DYEING QC', 'QUALITY CHECK 1'],
  EMBROIDERY: ['EMBROIDERY', 'EMB', 'EMBROIDERY DEPARTMENT'],
  THREAD_CUTTING: [
    'THREAD_CUTTING',
    'THREAD CUTTING',
    'THREAD',
    'THREAD CUTTING DEPARTMENT',
    'CUTTING',
  ],
  THREADCUT_QC: ['THREADCUT_QC', 'QC_2', 'THREADCUT QC', 'QUALITY CHECK 2'],
  FINISHING: ['FINISHING', 'FINISHING DEPARTMENT'],
  PACKING: ['PACKING', 'PACKING DEPARTMENT', 'DISPATCH'],
};

// Standard predecessor department chain
const PREDECESSORS: Record<string, string[]> = {
  STORE: ['PROGRAMMING'],
  FABRIC_STORE: ['PROGRAMMING'],
  DYEING: ['STORE', 'FABRIC_STORE'],
  DYEING_QC: ['DYEING'],
  EMBROIDERY: ['DYEING_QC', 'STORE', 'FABRIC_STORE'],
  THREAD_CUTTING: ['EMBROIDERY'],
  THREADCUT_QC: ['THREAD_CUTTING'],
  FINISHING: ['THREADCUT_QC'],
  PACKING: ['FINISHING'],
};

function normalizeDeptCode(dept: string): string {
  const upper = normalizeDepartmentCode(dept);
  // QC codes contain their parent department's name (THREADCUT_QC, DYEING_QC), so match them first.
  if (upper.includes('DYEING_QC') || upper.includes('QC_1')) return 'DYEING_QC';
  if (upper.includes('THREADCUT_QC') || upper.includes('QC_2')) return 'THREADCUT_QC';
  if (upper.includes('THREAD') || upper.includes('CUTTING')) return 'THREAD_CUTTING';
  if (upper.includes('EMB')) return 'EMBROIDERY';
  if (upper.includes('DYE')) return 'DYEING';
  if (upper.includes('STORE')) return 'STORE';
  if (upper.includes('FINISH')) return 'FINISHING';
  if (upper.includes('PACK')) return 'PACKING';
  return upper;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('programId');
    const rawDept =
      searchParams.get('department') ||
      searchParams.get('toDepartment') ||
      searchParams.get('currentDepartment') ||
      '';
    const parentChallanId = searchParams.get('parentChallanId');

    // 1. Direct Parent Challan Detection
    if (parentChallanId) {
      const parent = await prisma.challan.findUnique({
        where: { id: parentChallanId },
        include: { items: true, program: true },
      });

      if (parent) {
        const itemsTotal = parent.items.reduce(
          (sum, it) => sum + (Number(it.quantity) || 0),
          0
        );
        // The leftover pieces/fabric OUT from parent is this department's IN!
        // A challan mixing MTR and PCS lines has no single In quantity to carry forward.
        const isMixedUnit = parent.fabricUnit === 'MIXED';
        const detectedFabricIn = isMixedUnit
          ? 0
          : parent.fabricOut !== null && parent.fabricOut !== undefined
            ? parent.fabricOut
            : itemsTotal > 0
              ? itemsTotal
              : parent.fabricIn ?? 0;
        const detectedUnit = isMixedUnit ? null : parent.fabricUnit || parent.items[0]?.uom || 'MTR';

        return NextResponse.json({
          success: true,
          data: {
            detectedFabricIn,
            detectedUnit,
            detectedFromDepartment: parent.fromDepartment,
            detectedFromChallanId: parent.id,
            detectedFromChallanNumber: parent.challanNumber,
            recommendedFabricOut: detectedFabricIn,
            parentChallan: {
              id: parent.id,
              challanNumber: parent.challanNumber,
              fromDepartment: parent.fromDepartment,
              toDepartment: parent.toDepartment,
              fabricIn: parent.fabricIn,
              fabricOut: parent.fabricOut,
              fabricUnit: parent.fabricUnit,
              defectivePieces: parent.defectivePieces,
            },
          },
        });
      }
    }

    // 2. Department & Program Inbound Detection
    if (programId) {
      // Resolve actual program id (might be programNumber or serialNo)
      const prog = await prisma.program.findFirst({
        where: {
          OR: [
            { id: programId },
            { programNumber: programId },
            { programSerialNo: programId },
          ],
        },
        select: {
          id: true,
          programNumber: true,
          programSerialNo: true,
          targetQuantity: true,
          quantityMeasurement: true,
          fabricIssuedToDyeing: true,
          fabricName: true,
          fabricColor: true,
        },
      });

      const actualProgId = prog ? prog.id : programId;
      const normalizedDept = normalizeDeptCode(rawDept);

      if (normalizedDept) {
        const targetAliases = DEPT_ALIASES[normalizedDept] || [normalizedDept];

        // 2a. Look for latest Challan directed TO this department for this program
        let inboundChallan = await prisma.challan.findFirst({
          where: {
            programId: actualProgId,
            OR: targetAliases.map((alias) => ({
              toDepartment: { contains: alias, mode: 'insensitive' },
            })),
          },
          orderBy: { createdAt: 'desc' },
          include: { items: true },
        });

        // 2b. If not found by toDepartment, look for latest Challan issued FROM a known predecessor department
        if (!inboundChallan) {
          const predecessors = PREDECESSORS[normalizedDept] || [];
          if (predecessors.length > 0) {
            inboundChallan = await prisma.challan.findFirst({
              where: {
                programId: actualProgId,
                fromDepartment: { in: predecessors },
                // Don't pick up defect returns back to store
                NOT: { challanType: { in: ['DEFECT_RETURN', 'DEFECTIVE_RETURN'] } },
              },
              orderBy: { createdAt: 'desc' },
              include: { items: true },
            });
          }
        }

        if (inboundChallan) {
          const itemsTotal = inboundChallan.items.reduce(
            (sum, it) => sum + (Number(it.quantity) || 0),
            0
          );
          // The pieces/fabric OUT from the prior department is the IN for this department!
          const isMixedUnit = inboundChallan.fabricUnit === 'MIXED';
          const detectedFabricIn = isMixedUnit ? 0 :
            inboundChallan.fabricOut !== null && inboundChallan.fabricOut !== undefined
              ? inboundChallan.fabricOut
              : itemsTotal > 0
                ? itemsTotal
                : inboundChallan.fabricIn ?? 0;
          const detectedUnit =
            isMixedUnit ? null : inboundChallan.fabricUnit || inboundChallan.items[0]?.uom || 'MTR';

          return NextResponse.json({
            success: true,
            data: {
              detectedFabricIn,
              detectedUnit,
              detectedFromDepartment: inboundChallan.fromDepartment,
              detectedFromChallanId: inboundChallan.id,
              detectedFromChallanNumber: inboundChallan.challanNumber,
              recommendedFabricOut: detectedFabricIn,
              parentChallan: {
                id: inboundChallan.id,
                challanNumber: inboundChallan.challanNumber,
                fromDepartment: inboundChallan.fromDepartment,
                toDepartment: inboundChallan.toDepartment,
                fabricIn: inboundChallan.fabricIn,
                fabricOut: inboundChallan.fabricOut,
                fabricUnit: inboundChallan.fabricUnit,
                defectivePieces: inboundChallan.defectivePieces,
              },
            },
          });
        }
      }

      // If no inbound challan found, fallback to program initial values
      if (prog) {
        const detectedFabricIn = Number(
          prog.targetQuantity || prog.fabricIssuedToDyeing || 0
        );
        const detectedUnit = prog.quantityMeasurement === 'PCS' ? 'PCS' : 'MTR';

        return NextResponse.json({
          success: true,
          data: {
            detectedFabricIn,
            detectedUnit,
            detectedFromDepartment: 'PROGRAMMING_SHEET',
            detectedFromChallanId: null,
            detectedFromChallanNumber: prog.programSerialNo || prog.programNumber,
            recommendedFabricOut: detectedFabricIn,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        detectedFabricIn: 0,
        detectedUnit: 'MTR',
        detectedFromDepartment: null,
        detectedFromChallanId: null,
        detectedFromChallanNumber: null,
        recommendedFabricOut: 0,
      },
    });
  } catch (error: any) {
    console.error('Error in auto-detect endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to auto-detect incoming fabric count' },
      { status: 500 }
    );
  }
}
