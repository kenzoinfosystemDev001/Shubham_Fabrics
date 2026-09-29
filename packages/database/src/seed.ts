import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding Subham Fabrics MES Database ---');

  // Clean existing tables in reverse dependency order
  await prisma.defectLog.deleteMany();
  await prisma.qualityInspection.deleteMany();
  await prisma.productionTransaction.deleteMany();
  await prisma.inventoryStock.deleteMany();
  await prisma.challanItem.deleteMany();
  await prisma.challan.deleteMany();
  await prisma.programRouteStep.deleteMany();
  await prisma.programBOM.deleteMany();
  await prisma.programColor.deleteMany();
  await prisma.programSize.deleteMany();
  await prisma.programMeasurement.deleteMany();
  await prisma.programFabric.deleteMany();
  await prisma.program.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing records.');

  // 1. Seed Departments
  const departmentsData = [
    { code: 'STORE', name: 'Raw Material & Fabric Store', sequenceOrder: 1, description: 'Yarn, fabric rolls and trims inventory' },
    { code: 'DYEING', name: 'Dyeing & Processing Unit', sequenceOrder: 2, description: 'Batch dyeing, stenter, and shade matching' },
    { code: 'QC1', name: 'Fabric Inspection (4-Point)', sequenceOrder: 3, description: 'Greige and dyed fabric inspection table' },
    { code: 'CUTTING', name: 'Spreading & Cutting Section', sequenceOrder: 4, description: 'CAD plotting, lay spreading, and straight-knife cutting' },
    { code: 'EMBROIDERY', name: 'Embroidery Section', sequenceOrder: 5, description: 'Multi-head computerized embroidery' },
    { code: 'THREAD_CUTTING', name: 'Thread Trimming', sequenceOrder: 6, description: 'Cut panel thread trimming' },
    { code: 'WASHING', name: 'Garment Laundry & Wash', sequenceOrder: 7, description: 'Bio-polishing, enzyme wash, and softening' },
    { code: 'QC2', name: 'Cut-Piece & Wash Audit', sequenceOrder: 8, description: 'Post-wash shrinkage and shade inspection' },
    { code: 'RECUTTING', name: 'Panel Re-Cutting Section', sequenceOrder: 9, description: 'Defective panel replacement' },
    { code: 'STITCHING', name: 'Garment Assembly Lines', sequenceOrder: 10, description: 'Progressive bundle sewing lines' },
    { code: 'QC3', name: 'Inline & End-Line QC Audit', sequenceOrder: 11, description: '100% garment construction and measurement audit' },
    { code: 'FINISHING', name: 'Finishing & Stain Removal', sequenceOrder: 12, description: 'Thread sucking, spot cleaning, and button holing' },
    { code: 'BUTTON_ATTACHMENT', name: 'Button Attachment', sequenceOrder: 13, description: 'Button sewing and bartacking' },
    { code: 'STEAM_PRESS', name: 'Steam Pressing & Ironing', sequenceOrder: 14, description: 'Vacuum tables and boiler steam iron finish' },
    { code: 'PACKING', name: 'Folding & Packaging', sequenceOrder: 15, description: 'Tagging, polybag insertion, and master carton packing' },
    { code: 'FINISHED_GOODS', name: 'Finished Goods Warehouse', sequenceOrder: 16, description: 'Palletized carton staging' },
    { code: 'DISPATCH', name: 'Logistics & Dispatch Gate', sequenceOrder: 17, description: 'Container loading, weighment, and gate pass dispatch' },
  ];

  for (const dept of departmentsData) {
    await prisma.department.create({ data: dept });
  }
  console.log(`Created ${departmentsData.length} manufacturing departments.`);

  // 2. Seed Users
  const passwordHash = await bcrypt.hash('Admin@12345', 10);
  const usersData = [
    { username: 'admin', email: 'admin@subhamfabrics.com', fullName: 'Sujal Kumar (Director & Admin)', role: 'SUPER_ADMIN', departmentCode: 'STORE' },
    { username: 'prod_manager', email: 'rajesh.sharma@subhamfabrics.com', fullName: 'Rajesh Sharma (VP Production)', role: 'PRODUCTION_MANAGER', departmentCode: 'STITCHING' },
    { username: 'store_sup', email: 'mohan.verma@subhamfabrics.com', fullName: 'Mohan Verma (Store Head)', role: 'STORE_SUPERVISOR', departmentCode: 'STORE' },
    { username: 'cut_sup', email: 'arun.patel@subhamfabrics.com', fullName: 'Arun Patel (Cutting Master)', role: 'CUTTING_SUPERVISOR', departmentCode: 'CUTTING' },
    { username: 'stitch_sup', email: 'suresh.nair@subhamfabrics.com', fullName: 'Suresh Nair (Line Supervisor)', role: 'STITCHING_SUPERVISOR', departmentCode: 'STITCHING' },
    { username: 'qc_insp', email: 'vikram.singh@subhamfabrics.com', fullName: 'Vikram Singh (Senior QA)', role: 'QC_INSPECTOR', departmentCode: 'QC1' },
    { username: 'finish_sup', email: 'dinesh.yadav@subhamfabrics.com', fullName: 'Dinesh Yadav (Finishing Incharge)', role: 'FINISHING_SUPERVISOR', departmentCode: 'FINISHING' },
    { username: 'pack_sup', email: 'manoj.gupta@subhamfabrics.com', fullName: 'Manoj Gupta (Packing Supervisor)', role: 'PACKING_SUPERVISOR', departmentCode: 'PACKING' },
    { username: 'dispatch_mgr', email: 'karan.mehta@subhamfabrics.com', fullName: 'Karan Mehta (Dispatch Logistics)', role: 'DISPATCH_MANAGER', departmentCode: 'DISPATCH' },
  ];

  const createdUsers: Record<string, any> = {};
  for (const u of usersData) {
    createdUsers[u.username] = await prisma.user.create({
      data: {
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        passwordHash,
        role: u.role,
        departmentCode: u.departmentCode,
      },
    });
  }
  console.log(`Created ${Object.keys(createdUsers).length} factory operators and supervisors.`);

  // 3. Seed Program PRG-2026-0001
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + 30);

  const program = await prisma.program.create({
    data: {
      programNumber: 'PRG-2026-0001',
      programDate: new Date(),
      buyer: 'ZARA Global Sourcing Ltd.',
      orderNumber: 'PO-ZARA-78901',
      designNumber: 'DES-9921',
      designName: "Men's Mercerized Pima Pique Polo",
      designVersion: 'v1.0',
      patternNumber: 'PAT-POLO-2026-M',
      styleCode: 'POLO-SLIM-01',
      productCategory: 'Men Knitted Polo T-Shirt',
      description: 'Premium mercerized pique polo shirt with ribbed collar, 2-button placket, and side vents.',
      referenceImageUrl: 'https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?auto=format&fit=crop&w=800&q=80',
      targetQuantity: 1200,
      deliveryDate,
      priority: 'HIGH',
      status: 'APPROVED',
      createdById: createdUsers.admin.id,
      approvedById: createdUsers.prod_manager.id,
      approvedAt: new Date(),

      fabrics: {
        create: [
          {
            fabricCode: 'FAB-PIQ-01',
            fabricName: '100% Pima Cotton Pique Knit',
            fabricType: 'Circular Knit Pique',
            composition: '100% Combed Compact Pima Cotton',
            widthInInches: 72,
            gsm: 220,
            colour: 'Royal Blue & Olive Green',
            shade: 'Dark Navy Tone / Deep Olive',
            requiredQuantity: 650.0,
            tolerancePercentage: 3.5,
            supplier: 'Vardhman Textiles Ltd.',
          },
        ],
      },

      measurements: {
        create: [
          { size: 'S', length: 69.0, chest: 50.0, waist: 48.0, shoulder: 42.0, sleeveLength: 21.0, armhole: 23.0, neck: 38.0, bottom: 49.0 },
          { size: 'M', length: 71.0, chest: 53.0, waist: 51.0, shoulder: 44.0, sleeveLength: 22.0, armhole: 24.5, neck: 39.5, bottom: 52.0 },
          { size: 'L', length: 73.0, chest: 56.0, waist: 54.0, shoulder: 46.0, sleeveLength: 23.0, armhole: 26.0, neck: 41.0, bottom: 55.0 },
          { size: 'XL', length: 75.0, chest: 59.0, waist: 57.0, shoulder: 48.0, sleeveLength: 24.0, armhole: 27.5, neck: 42.5, bottom: 58.0 },
        ],
      },

      sizeMatrix: {
        create: [
          { size: 'S', targetQuantity: 200 },
          { size: 'M', targetQuantity: 400 },
          { size: 'L', targetQuantity: 400 },
          { size: 'XL', targetQuantity: 200 },
        ],
      },

      colorMatrix: {
        create: [
          { colorCode: 'CLR-ROYAL-BLU', colorName: 'Royal Blue', pantoneReference: 'PANTONE 19-4052 TCX', shade: 'Shade-A', targetQuantity: 600 },
          { colorCode: 'CLR-OLIVE-GRN', colorName: 'Olive Green', pantoneReference: 'PANTONE 18-0527 TCX', shade: 'Shade-B', targetQuantity: 600 },
        ],
      },

      bomItems: {
        create: [
          { itemCode: 'TRM-BTN-01', itemName: 'Laser Engraved 18L 4-Hole Resin Button', category: 'BUTTON', requiredQuantityPerPiece: 3.0, uom: 'PCS', wastagePercentage: 2.0, totalRequiredQuantity: 3672.0, supplier: 'Prym Fashion' },
          { itemCode: 'TRM-THRD-01', itemName: 'Spun Polyester Sewing Thread 40/2', category: 'THREAD', requiredQuantityPerPiece: 120.0, uom: 'MTR', wastagePercentage: 5.0, totalRequiredQuantity: 151200.0, supplier: 'Coats India' },
          { itemCode: 'TRM-LBL-01', itemName: 'Damask Woven Main Brand Label', category: 'LABEL', requiredQuantityPerPiece: 1.0, uom: 'PCS', wastagePercentage: 1.0, totalRequiredQuantity: 1212.0, supplier: 'Avery Dennison' },
          { itemCode: 'TRM-TAG-01', itemName: 'FSC Certified Hangtag with Cotton String', category: 'TAG', requiredQuantityPerPiece: 1.0, uom: 'PCS', wastagePercentage: 1.0, totalRequiredQuantity: 1212.0, supplier: 'Subham Packaging' },
          { itemCode: 'TRM-BAG-01', itemName: 'Biodegradable Self-Adhesive Polybag 12x15', category: 'PACKING_BAG', requiredQuantityPerPiece: 1.0, uom: 'PCS', wastagePercentage: 2.0, totalRequiredQuantity: 1224.0, supplier: 'BioPoly Packs' },
          { itemCode: 'TRM-CTN-01', itemName: '7-Ply Corrugated Master Carton (24 pcs/ctn)', category: 'CARTON', requiredQuantityPerPiece: 0.0416, uom: 'PCS', wastagePercentage: 1.0, totalRequiredQuantity: 51.0, supplier: 'National Boxes' },
        ],
      },

      routeSteps: {
        create: departmentsData.map((d) => ({
          sequenceOrder: d.sequenceOrder,
          departmentCode: d.code,
          standardCycleTimeMinutes: 45.0,
          isMandatory: true,
          requiresQCGate: ['QC1', 'QC2', 'QC3'].includes(d.code),
        })),
      },
    },
  });
  console.log(`Created Program: ${program.programNumber} with complete specs, BOM, and 17-department route.`);

  // 4. Seed Seed Inward Fabric Challan: STORE -> CUTTING
  const challanDate = new Date();
  const challan = await prisma.challan.create({
    data: {
      challanNumber: 'CH-STR-2026-000101',
      challanType: 'FABRIC_ISSUE',
      programId: program.id,
      fromDepartment: 'STORE',
      toDepartment: 'CUTTING',
      status: 'RECEIVED',
      priority: 'HIGH',
      issuedDate: challanDate,
      receivedDate: challanDate,
      createdById: createdUsers.store_sup.id,
      issuedById: createdUsers.store_sup.id,
      receivedById: createdUsers.cut_sup.id,
      approvedById: createdUsers.prod_manager.id,
      remarks: 'Issued 6 Rolls of 100% Pima Cotton Pique Knit for Cutting Lay #LAY-01.',

      items: {
        create: [
          { itemDescription: 'Fabric Roll #1 - Royal Blue', fabricCode: 'FAB-PIQ-01', colour: 'Royal Blue', shade: 'Shade-A', unitType: 'ROLL', rollNumber: 'ROL-BLU-001', lotNumber: 'LOT-2026-PC-99', barcode: 'BAR-ROL-001', quantity: 110.0, grossWeightKg: 112.5, netWeightKg: 110.0, uom: 'KG' },
          { itemDescription: 'Fabric Roll #2 - Royal Blue', fabricCode: 'FAB-PIQ-01', colour: 'Royal Blue', shade: 'Shade-A', unitType: 'ROLL', rollNumber: 'ROL-BLU-002', lotNumber: 'LOT-2026-PC-99', barcode: 'BAR-ROL-002', quantity: 110.0, grossWeightKg: 112.0, netWeightKg: 110.0, uom: 'KG' },
          { itemDescription: 'Fabric Roll #3 - Royal Blue', fabricCode: 'FAB-PIQ-01', colour: 'Royal Blue', shade: 'Shade-A', unitType: 'ROLL', rollNumber: 'ROL-BLU-003', lotNumber: 'LOT-2026-PC-99', barcode: 'BAR-ROL-003', quantity: 105.0, grossWeightKg: 107.0, netWeightKg: 105.0, uom: 'KG' },
          { itemDescription: 'Fabric Roll #4 - Olive Green', fabricCode: 'FAB-PIQ-01', colour: 'Olive Green', shade: 'Shade-B', unitType: 'ROLL', rollNumber: 'ROL-OLV-001', lotNumber: 'LOT-2026-PC-99', barcode: 'BAR-ROL-004', quantity: 110.0, grossWeightKg: 112.0, netWeightKg: 110.0, uom: 'KG' },
          { itemDescription: 'Fabric Roll #5 - Olive Green', fabricCode: 'FAB-PIQ-01', colour: 'Olive Green', shade: 'Shade-B', unitType: 'ROLL', rollNumber: 'ROL-OLV-002', lotNumber: 'LOT-2026-PC-99', barcode: 'BAR-ROL-005', quantity: 110.0, grossWeightKg: 112.0, netWeightKg: 110.0, uom: 'KG' },
          { itemDescription: 'Fabric Roll #6 - Olive Green', fabricCode: 'FAB-PIQ-01', colour: 'Olive Green', shade: 'Shade-B', unitType: 'ROLL', rollNumber: 'ROL-OLV-003', lotNumber: 'LOT-2026-PC-99', barcode: 'BAR-ROL-006', quantity: 105.0, grossWeightKg: 107.0, netWeightKg: 105.0, uom: 'KG' },
        ],
      },
    },
  });
  console.log(`Created Challan: ${challan.challanNumber} with 6 tracked rolls.`);

  // 5. Seed Production Accounting Record for Cutting Department
  // 650.0 KG Input = 620.0 Good + 0 Rework + 10.0 Reject (Fabric End-Bit Flaw) + 20.0 Waste (Marker Trim) + 0 Balance
  const cuttingProduction = await prisma.productionTransaction.create({
    data: {
      programId: program.id,
      challanId: challan.id,
      departmentCode: 'CUTTING',
      operationName: 'Spreading, Marker Laying & Auto-Cutting',
      operatorId: createdUsers.cut_sup.id,
      machineId: 'CUT-TABLE-01',
      shift: 'Shift-A (Morning)',
      inputQuantity: 650.0,
      goodQuantity: 620.0,
      reworkQuantity: 0.0,
      rejectQuantity: 10.0,
      wasteQuantity: 20.0,
      balanceQuantity: 0.0,
      unitOfMeasure: 'KG',
      rejectReason: 'End-bit weaving bar fault detected on Roll #3',
      wasteReason: 'Standard table end allowance and selvage trimming',
      notes: 'Cutting completed. 1,200 garment panels bundled into 60 bundle packs.',
    },
  });
  console.log(`Recorded Strict Cutting Production Accounting: ${cuttingProduction.inputQuantity} KG input = ${cuttingProduction.goodQuantity + cuttingProduction.reworkQuantity + cuttingProduction.rejectQuantity + cuttingProduction.wasteQuantity + cuttingProduction.balanceQuantity} KG output.`);

  // 6. Seed Outward Cut-Bundles Challan: CUTTING -> STITCHING
  const cutChallan = await prisma.challan.create({
    data: {
      challanNumber: 'CH-CUT-2026-000201',
      challanType: 'INTER_DEPARTMENT',
      programId: program.id,
      parentChallanId: challan.id, // Genealogy link
      fromDepartment: 'CUTTING',
      toDepartment: 'STITCHING',
      status: 'ISSUED',
      priority: 'HIGH',
      issuedDate: new Date(),
      createdById: createdUsers.cut_sup.id,
      issuedById: createdUsers.cut_sup.id,
      remarks: 'Issued 60 bundles (1,200 pcs total) to Assembly Line #3.',
      items: {
        create: [
          { itemDescription: 'Cut Garment Bundles - Size S (Royal Blue)', colour: 'Royal Blue', size: 'S', unitType: 'BUNDLE', bundleNumber: 'BDL-BLU-S-01', barcode: 'BAR-BDL-001', quantity: 100.0, uom: 'PCS', sourceRollId: 'ROL-BLU-001' },
          { itemDescription: 'Cut Garment Bundles - Size S (Royal Blue)', colour: 'Royal Blue', size: 'S', unitType: 'BUNDLE', bundleNumber: 'BDL-BLU-S-02', barcode: 'BAR-BDL-002', quantity: 100.0, uom: 'PCS', sourceRollId: 'ROL-BLU-001' },
          { itemDescription: 'Cut Garment Bundles - Size M (Royal Blue)', colour: 'Royal Blue', size: 'M', unitType: 'BUNDLE', bundleNumber: 'BDL-BLU-M-01', barcode: 'BAR-BDL-003', quantity: 200.0, uom: 'PCS', sourceRollId: 'ROL-BLU-002' },
          { itemDescription: 'Cut Garment Bundles - Size L (Royal Blue)', colour: 'Royal Blue', size: 'L', unitType: 'BUNDLE', bundleNumber: 'BDL-BLU-L-01', barcode: 'BAR-BDL-004', quantity: 200.0, uom: 'PCS', sourceRollId: 'ROL-BLU-003' },
          { itemDescription: 'Cut Garment Bundles - Size S (Olive Green)', colour: 'Olive Green', size: 'S', unitType: 'BUNDLE', bundleNumber: 'BDL-OLV-S-01', barcode: 'BAR-BDL-005', quantity: 100.0, uom: 'PCS', sourceRollId: 'ROL-OLV-001' },
          { itemDescription: 'Cut Garment Bundles - Size M (Olive Green)', colour: 'Olive Green', size: 'M', unitType: 'BUNDLE', bundleNumber: 'BDL-OLV-M-01', barcode: 'BAR-BDL-006', quantity: 200.0, uom: 'PCS', sourceRollId: 'ROL-OLV-002' },
          { itemDescription: 'Cut Garment Bundles - Size L (Olive Green)', colour: 'Olive Green', size: 'L', unitType: 'BUNDLE', bundleNumber: 'BDL-OLV-L-01', barcode: 'BAR-BDL-007', quantity: 200.0, uom: 'PCS', sourceRollId: 'ROL-OLV-002' },
          { itemDescription: 'Cut Garment Bundles - Size XL (Olive Green)', colour: 'Olive Green', size: 'XL', unitType: 'BUNDLE', bundleNumber: 'BDL-OLV-XL-01', barcode: 'BAR-BDL-008', quantity: 100.0, uom: 'PCS', sourceRollId: 'ROL-OLV-003' },
        ],
      },
    },
  });
  console.log(`Created Outward Challan with genealogy: ${cutChallan.challanNumber}`);

  // 7. Seed Initial Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        actorId: createdUsers.admin.id,
        action: 'PROGRAM_CREATED',
        entity: 'Program',
        entityId: program.id,
        afterState: JSON.stringify({ programNumber: program.programNumber, targetQuantity: program.targetQuantity }),
        ipAddress: '192.168.1.10',
        userAgent: 'Subham-MES/Desktop-Client',
      },
      {
        actorId: createdUsers.prod_manager.id,
        action: 'PROGRAM_APPROVED',
        entity: 'Program',
        entityId: program.id,
        afterState: JSON.stringify({ status: 'APPROVED', approvedBy: createdUsers.prod_manager.username }),
        ipAddress: '192.168.1.15',
        userAgent: 'Subham-MES/Desktop-Client',
      },
      {
        actorId: createdUsers.store_sup.id,
        action: 'CHALLAN_CREATED',
        entity: 'Challan',
        entityId: challan.id,
        afterState: JSON.stringify({ challanNumber: challan.challanNumber, toDepartment: 'CUTTING' }),
        ipAddress: '192.168.1.20',
        userAgent: 'Subham-MES/Handheld-Terminal',
      },
      {
        actorId: createdUsers.cut_sup.id,
        action: 'PRODUCTION_RECORDED',
        entity: 'ProductionTransaction',
        entityId: cuttingProduction.id,
        afterState: JSON.stringify({ inputQuantity: 650.0, goodQuantity: 620.0, wasteQuantity: 20.0 }),
        ipAddress: '192.168.1.25',
        userAgent: 'Subham-MES/Cutting-Station-PC',
      },
    ],
  });
  console.log('Seeded audit logs for traceability verification.');

  console.log('=== Database Seeding Completed Successfully ===');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
