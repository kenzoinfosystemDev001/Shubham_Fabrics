import { PrismaClient } from './generated/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('=== SEEDING SUBHAM FABRICS MES (NEON POSTGRESQL) ===');

  // 1. Clean existing tables safely
  await prisma.rolePermission.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.defectLog.deleteMany();
  await prisma.qualityInspection.deleteMany();
  await prisma.productionTransaction.deleteMany();
  await prisma.inventoryStock.deleteMany();
  await prisma.challanItem.deleteMany();
  await prisma.challan.deleteMany();
  await prisma.programRouteStep.deleteMany();
  await prisma.programRoute.deleteMany();
  await prisma.programBOM.deleteMany();
  await prisma.programSpecification.deleteMany();
  await prisma.programSize.deleteMany();
  await prisma.programColour.deleteMany();
  await prisma.programFabric.deleteMany();
  await prisma.program.deleteMany();
  await prisma.design.deleteMany();
  await prisma.operation.deleteMany();
  await prisma.defectCode.deleteMany();
  await prisma.machine.deleteMany();
  await prisma.workCenter.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.department.deleteMany();
  await prisma.trim.deleteMany();
  await prisma.fabric.deleteMany();
  await prisma.item.deleteMany();
  await prisma.size.deleteMany();
  await prisma.colour.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleaned previous data.');

  // 2. Seed Roles
  const rolesList = [
    { code: 'SUPER_ADMIN', name: 'Super Administrator', description: 'Full unrestricted platform access', isSystem: true },
    { code: 'ADMIN', name: 'Administrator', description: 'Full business management access', isSystem: true },
    { code: 'PRODUCTION_MANAGER', name: 'Production Manager', description: 'Program approval and floor management', isSystem: true },
    { code: 'STORE_MANAGER', name: 'Store Manager', description: 'Raw material & fabric store head', isSystem: true },
    { code: 'STORE_OPERATOR', name: 'Store Operator', description: 'Store issues and inwards' },
    { code: 'DYEING_OPERATOR', name: 'Dyeing Station Operator', description: 'Dyeing unit operator' },
    { code: 'CUTTING_OPERATOR', name: 'Cutting Master / Operator', description: 'Cutting lay supervisor' },
    { code: 'EMBROIDERY_OPERATOR', name: 'Embroidery Operator', description: 'Embroidery section operator' },
    { code: 'WASHING_OPERATOR', name: 'Laundry / Wash Operator', description: 'Washing plant operator' },
    { code: 'STITCHING_OPERATOR', name: 'Stitching Line Supervisor', description: 'Assembly line sewing incharge' },
    { code: 'QC_MANAGER', name: 'Quality Assurance Manager', description: 'Overall QA head' },
    { code: 'QC_INSPECTOR', name: 'Quality Controller / Inspector', description: 'Station gate auditor' },
    { code: 'FINISHING_OPERATOR', name: 'Finishing Supervisor', description: 'Finishing and packaging' },
    { code: 'PACKING_OPERATOR', name: 'Packing Supervisor', description: 'Carton and packing operator' },
    { code: 'DISPATCH_OPERATOR', name: 'Dispatch Logistics Manager', description: 'Gate pass and shipping' },
    { code: 'SUPERVISOR', name: 'General Floor Supervisor', description: 'Line monitoring' },
    { code: 'FABRIC_STORE', name: 'Fabric Store Incharge', description: 'Fabric store material receiving, QC, and issues' },
    { code: 'VIEWER', name: 'Auditor / Read-Only Viewer', description: 'Read-only telemetry access' },
  ];

  const createdRoles: Record<string, any> = {};
  for (const r of rolesList) {
    createdRoles[r.code] = await prisma.role.create({ data: r });
  }
  console.log(`Created ${rolesList.length} security roles.`);

  // 3. Seed Permissions (Module, Resource, Action)
  const permissionsList = [
    // Program
    { module: 'PROGRAM', resource: 'PROGRAM_FILE', action: 'CREATE', description: 'Create new Program files' },
    { module: 'PROGRAM', resource: 'PROGRAM_FILE', action: 'READ', description: 'View Program files' },
    { module: 'PROGRAM', resource: 'PROGRAM_FILE', action: 'UPDATE', description: 'Edit Program files' },
    { module: 'PROGRAM', resource: 'PROGRAM_FILE', action: 'APPROVE', description: 'Authorize Program for production' },
    { module: 'PROGRAM', resource: 'PROGRAM_FILE', action: 'CANCEL', description: 'Cancel Program' },
    { module: 'PROGRAM', resource: 'ROUTE', action: 'CREATE', description: 'Configure custom route' },
    { module: 'PROGRAM', resource: 'ROUTE', action: 'UPDATE', description: 'Edit custom route' },
    { module: 'PROGRAM', resource: 'BOM', action: 'UPDATE', description: 'Edit Bill of Materials' },
    // Challan
    { module: 'CHALLAN', resource: 'CHALLAN_RECORD', action: 'CREATE', description: 'Draft new Challans' },
    { module: 'CHALLAN', resource: 'CHALLAN_RECORD', action: 'READ', description: 'View Challans' },
    { module: 'CHALLAN', resource: 'CHALLAN_RECORD', action: 'ISSUE', description: 'Dispatch Challan from department' },
    { module: 'CHALLAN', resource: 'CHALLAN_RECORD', action: 'RECEIVE', description: 'Acknowledge Challan receipt' },
    { module: 'CHALLAN', resource: 'CHALLAN_RECORD', action: 'COMPLETE', description: 'Mark station completion' },
    // Master Data
    { module: 'MASTER_DATA', resource: 'SUPPLIER', action: 'CREATE', description: 'Add new supplier' },
    { module: 'MASTER_DATA', resource: 'SUPPLIER', action: 'READ', description: 'View suppliers' },
    { module: 'MASTER_DATA', resource: 'SUPPLIER', action: 'UPDATE', description: 'Edit supplier details' },
    { module: 'MASTER_DATA', resource: 'CUSTOMER', action: 'CREATE', description: 'Add new customer/buyer' },
    { module: 'MASTER_DATA', resource: 'CUSTOMER', action: 'READ', description: 'View customers' },
    { module: 'MASTER_DATA', resource: 'CUSTOMER', action: 'UPDATE', description: 'Edit customer' },
    { module: 'MASTER_DATA', resource: 'FABRIC', action: 'CREATE', description: 'Add fabric specification' },
    { module: 'MASTER_DATA', resource: 'FABRIC', action: 'READ', description: 'View fabric catalog' },
    { module: 'MASTER_DATA', resource: 'FABRIC', action: 'UPDATE', description: 'Update fabric catalog' },
    { module: 'MASTER_DATA', resource: 'TRIM', action: 'CREATE', description: 'Add trim item' },
    { module: 'MASTER_DATA', resource: 'TRIM', action: 'READ', description: 'View trims catalog' },
    { module: 'MASTER_DATA', resource: 'DESIGN', action: 'CREATE', description: 'Register design style' },
    { module: 'MASTER_DATA', resource: 'DESIGN', action: 'READ', description: 'View design styles' },
    { module: 'MASTER_DATA', resource: 'COLOUR', action: 'CREATE', description: 'Add colour code' },
    { module: 'MASTER_DATA', resource: 'COLOUR', action: 'READ', description: 'View colours' },
    { module: 'MASTER_DATA', resource: 'SIZE', action: 'CREATE', description: 'Add size' },
    { module: 'MASTER_DATA', resource: 'SIZE', action: 'READ', description: 'View sizes' },
    { module: 'MASTER_DATA', resource: 'DEPARTMENT', action: 'READ', description: 'View departments' },
    { module: 'MASTER_DATA', resource: 'DEPARTMENT', action: 'UPDATE', description: 'Modify department config' },
    // Quality & Production
    { module: 'QUALITY', resource: 'INSPECTION', action: 'CREATE', description: 'Record inspection audit' },
    { module: 'QUALITY', resource: 'INSPECTION', action: 'READ', description: 'View inspection reports' },
    { module: 'AUDIT', resource: 'LOGS', action: 'READ', description: 'View immutable audit trail' },
    // Fabric Store Department
    { module: 'FABRIC_STORE', resource: 'STORE', action: 'VIEW', description: 'View fabric store dashboard and inventory' },
    { module: 'FABRIC_STORE', resource: 'GRN', action: 'RECEIVE', description: 'Create GRN and inward fabric rolls' },
    { module: 'FABRIC_STORE', resource: 'ROLL', action: 'QC', description: 'Conduct quality inspections and audit rolls' },
    { module: 'FABRIC_STORE', resource: 'MATERIAL', action: 'ISSUE', description: 'Issue fabric rolls to production programs' },
    { module: 'FABRIC_STORE', resource: 'MATERIAL', action: 'RETURN', description: 'Accept fabric returns from shop floor' },
    { module: 'FABRIC_STORE', resource: 'LOCATION', action: 'MANAGE', description: 'Configure inventory racks and storage zones' },
    { module: 'FABRIC_STORE', resource: 'LEDGER', action: 'VIEW', description: 'Access immutable stock movement ledger' },
    { module: 'FABRIC_STORE', resource: 'REPORT', action: 'EXPORT', description: 'Generate and export fabric inventory reports' },
  ];

  const createdPerms: Record<string, any> = {};
  for (const p of permissionsList) {
    const key = `${p.module}_${p.resource}_${p.action}`;
    createdPerms[key] = await prisma.permission.create({ data: p });
  }
  console.log(`Created ${permissionsList.length} fine-grained permissions.`);

  // Link all permissions to SUPER_ADMIN & ADMIN
  for (const permKey of Object.keys(createdPerms)) {
    const p = createdPerms[permKey];
    await prisma.rolePermission.create({
      data: { roleId: createdRoles.SUPER_ADMIN.id, permissionId: p.id },
    });
    await prisma.rolePermission.create({
      data: { roleId: createdRoles.ADMIN.id, permissionId: p.id },
    });
  }

  // Link Fabric Store permissions to FABRIC_STORE role
  for (const permKey of Object.keys(createdPerms)) {
    const p = createdPerms[permKey];
    if (p.module === 'FABRIC_STORE') {
      await prisma.rolePermission.create({
        data: { roleId: createdRoles.FABRIC_STORE.id, permissionId: p.id },
      });
    }
  }

  // Production Manager gets Program, Route, BOM, Master reads
  for (const permKey of Object.keys(createdPerms)) {
    const p = createdPerms[permKey];
    if (p.module === 'PROGRAM' || p.action === 'READ' || p.module === 'QUALITY') {
      await prisma.rolePermission.create({
        data: { roleId: createdRoles.PRODUCTION_MANAGER.id, permissionId: p.id },
      });
    }
  }

  // 4. Seed Users
  const hashFn = (bcrypt as any).hash || (bcrypt as any).default?.hash;
  const passwordHash = await hashFn('Admin@12345', 10);

  const usersList = [
    { username: 'admin', email: 'admin@subhamfabrics.com', fullName: 'Sujal Kumar', roleCode: 'SUPER_ADMIN', departmentCode: 'STORE' },
    { username: 'programmer', email: 'programmer@subhamfabrics.com', fullName: 'Programming Incharge', roleCode: 'SUPER_ADMIN', departmentCode: 'PROGRAMMING' },
    { username: 'jitender', email: 'jitender.saini@subhamfabrics.com', fullName: 'jitender saini', roleCode: 'STORE_MANAGER', departmentCode: 'STORE' },
    { username: 'prod_manager', email: 'rajesh.sharma@subhamfabrics.com', fullName: 'Rajesh Sharma', roleCode: 'PRODUCTION_MANAGER', departmentCode: 'STITCHING' },
    { username: 'store_mgr', email: 'mohan.verma@subhamfabrics.com', fullName: 'Mohan Verma', roleCode: 'STORE_MANAGER', departmentCode: 'STORE' },
    { username: 'cut_sup', email: 'arun.patel@subhamfabrics.com', fullName: 'Arun Patel', roleCode: 'CUTTING_OPERATOR', departmentCode: 'CUTTING' },
    { username: 'stitch_sup', email: 'suresh.nair@subhamfabrics.com', fullName: 'Suresh Nair', roleCode: 'STITCHING_OPERATOR', departmentCode: 'STITCHING' },
    { username: 'qc_insp', email: 'vikram.singh@subhamfabrics.com', fullName: 'Vikram Singh', roleCode: 'QC_INSPECTOR', departmentCode: 'QC1' },
    { username: 'viewer', email: 'auditor@subhamfabrics.com', fullName: 'Third Party Auditor', roleCode: 'VIEWER', departmentCode: 'STORE' },
  ];

  const createdUsers: Record<string, any> = {};
  for (const u of usersList) {
    const user = await prisma.user.create({
      data: {
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        passwordHash,
        departmentCode: u.departmentCode,
      },
    });
    createdUsers[u.username] = user;

    // Assign Role in user_roles table
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: createdRoles[u.roleCode].id,
      },
    });
  }
  console.log(`Created ${usersList.length} authenticated users with relational roles.`);

  // 5. Seed Departments, Work Centers, Machines & Shifts
  const depts = [
    { code: 'PROGRAMMING', name: 'Programming Department', sequenceOrder: 0, description: 'CAD, Wilcom embroidery design, specs & production sheet authoring' },
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

  const createdDepts: Record<string, any> = {};
  for (const d of depts) {
    createdDepts[d.code] = await prisma.department.create({ data: d });
  }

  // Work Centers & Machines
  const cuttingWC = await prisma.workCenter.create({
    data: {
      code: 'WC-CUT-01',
      name: 'Spreading & Automatic Lay Cutting Center',
      departmentId: createdDepts.CUTTING.id,
      capacityPerHour: 450,
    },
  });

  const stitchingWC = await prisma.workCenter.create({
    data: {
      code: 'WC-STC-01',
      name: 'Progressive Assembly Line #1',
      departmentId: createdDepts.STITCHING.id,
      capacityPerHour: 120,
    },
  });

  await prisma.machine.createMany({
    data: [
      { code: 'MAC-CUT-01', name: 'Gerber Auto-Cutter GTx', machineType: 'AUTO_CUTTER', workCenterId: cuttingWC.id, serialNumber: 'GER-89410' },
      { code: 'MAC-STC-01', name: 'Juki DDL-9000C Single Needle', machineType: 'SEWING_SINGLE_NEEDLE', workCenterId: stitchingWC.id, serialNumber: 'JUK-1120' },
      { code: 'MAC-STC-02', name: 'Pegasus 5-Thread Overlock M900', machineType: 'OVERLOCK', workCenterId: stitchingWC.id, serialNumber: 'PEG-5541' },
    ],
  });

  // Shifts
  await prisma.shift.createMany({
    data: [
      { code: 'SHIFT_A', name: 'Morning General Shift', startTime: '08:00', endTime: '16:30', durationHours: 8.0 },
      { code: 'SHIFT_B', name: 'Evening Shift', startTime: '16:30', endTime: '01:00', durationHours: 8.0 },
      { code: 'SHIFT_C', name: 'Night Shift', startTime: '01:00', endTime: '08:00', durationHours: 7.0 },
    ],
  });

  // 6. Seed Customers & Suppliers
  const customerZara = await prisma.customer.create({
    data: {
      code: 'CUST-ZARA',
      name: 'ZARA Global Sourcing Ltd.',
      contactPerson: 'Elena Rostova',
      email: 'sourcing.orders@inditex.com',
      phone: '+34 981 185 400',
      address: 'Arteixo, A Coruña, Spain',
      country: 'Spain',
      buyerGroup: 'Inditex',
      currency: 'EUR',
    },
  });

  const customerMS = await prisma.customer.create({
    data: {
      code: 'CUST-MS',
      name: 'Marks & Spencer Reliance India',
      contactPerson: 'Aditya Sen',
      email: 'aditya.sen@marksandspencer.com',
      phone: '+91 124 4567890',
      address: 'Cyber City, Gurugram, India',
      country: 'India',
      buyerGroup: 'M&S London',
      currency: 'INR',
    },
  });

  const supplierVardhman = await prisma.supplier.create({
    data: {
      code: 'SUP-VARDHMAN',
      name: 'Vardhman Textiles Ltd.',
      contactPerson: 'Raman Sood',
      email: 'sales.yarn@vardhman.com',
      phone: '+91 161 2228943',
      address: 'Chandigarh Road, Ludhiana, Punjab',
      taxNumber: '03AAACV0549H1Z0',
      paymentTerms: 'Net 45 Days',
      rating: 4.9,
    },
  });

  const supplierCoats = await prisma.supplier.create({
    data: {
      code: 'SUP-COATS',
      name: 'Coats India Ltd.',
      contactPerson: 'Meenakshi Sundaram',
      email: 'threads.order@coats.com',
      phone: '+91 80 4118 7000',
      address: 'Richmond Road, Bangalore, Karnataka',
      taxNumber: '29AAACC1234J1Z5',
      paymentTerms: 'Net 30 Days',
      rating: 4.8,
    },
  });

  // 7. Seed Fabrics, Trims, Colours & Sizes Masters
  const fabricPique = await prisma.fabric.create({
    data: {
      code: 'FAB-PIQ-01',
      name: '100% Pima Cotton Pique Knit',
      fabricType: 'KNIT_PIQUE',
      composition: '100% Combed Compact Pima Cotton',
      widthInInches: 72,
      gsm: 220,
      weaveType: 'Honeycomb Pique Knit',
      supplierId: supplierVardhman.id,
    },
  });

  const fabricJersey = await prisma.fabric.create({
    data: {
      code: 'FAB-SNG-01',
      name: 'Single Jersey Super-Combed 180 GSM',
      fabricType: 'SINGLE_JERSEY',
      composition: '100% Cotton',
      widthInInches: 60,
      gsm: 180,
      weaveType: 'Single Knit',
      supplierId: supplierVardhman.id,
    },
  });

  await prisma.trim.createMany({
    data: [
      { code: 'TRM-BTN-01', name: 'Laser Engraved 18L 4-Hole Resin Button', trimCategory: 'BUTTON', specification: '18 Ligne, 4-hole, dyed-to-match', uom: 'PCS', supplierId: supplierCoats.id },
      { code: 'TRM-THRD-01', name: 'Spun Polyester Sewing Thread 40/2', trimCategory: 'THREAD', specification: 'Coats Epic 40/2 5000m Cone', uom: 'MTR', supplierId: supplierCoats.id },
      { code: 'TRM-LBL-01', name: 'Damask Woven Main Brand Label', trimCategory: 'LABEL', specification: 'Heat-cut soft edge damask', uom: 'PCS' },
      { code: 'TRM-TAG-01', name: 'FSC Certified Hangtag with Cotton String', trimCategory: 'TAG', specification: '350 GSM recycled art card', uom: 'PCS' },
    ],
  });

  const colRoyal = await prisma.colour.create({ data: { code: 'CLR-ROYAL-BLU', name: 'Royal Blue', hexCode: '#1e40af', pantoneCode: 'PANTONE 19-4052 TCX' } });
  const colOlive = await prisma.colour.create({ data: { code: 'CLR-OLIVE-GRN', name: 'Olive Green', hexCode: '#365314', pantoneCode: 'PANTONE 18-0527 TCX' } });
  await prisma.colour.create({ data: { code: 'CLR-JET-BLK', name: 'Jet Black', hexCode: '#09090b', pantoneCode: 'PANTONE 19-4008 TCX' } });

  const sizeS = await prisma.size.create({ data: { code: 'S', name: 'Small', sortOrder: 1, sizeGroup: 'ADULT' } });
  const sizeM = await prisma.size.create({ data: { code: 'M', name: 'Medium', sortOrder: 2, sizeGroup: 'ADULT' } });
  const sizeL = await prisma.size.create({ data: { code: 'L', name: 'Large', sortOrder: 3, sizeGroup: 'ADULT' } });
  const sizeXL = await prisma.size.create({ data: { code: 'XL', name: 'Extra Large', sortOrder: 4, sizeGroup: 'ADULT' } });

  // 8. Operations & Defect Codes Masters
  const opCut = await prisma.operation.create({
    data: {
      code: 'OP-CUT-01',
      name: 'Spreading, Marker Laying & Auto-Cutting',
      departmentId: createdDepts.CUTTING.id,
      standardCycleTimeSeconds: 120,
      difficultyLevel: 'STANDARD',
      pieceRate: 2.5,
    },
  });

  await prisma.operation.create({
    data: {
      code: 'OP-STC-01',
      name: 'Collar Rib Attachment & Front Placket Sewing',
      departmentId: createdDepts.STITCHING.id,
      standardCycleTimeSeconds: 180,
      difficultyLevel: 'COMPLEX',
      pieceRate: 5.0,
    },
  });

  await prisma.defectCode.createMany({
    data: [
      { code: 'DEF-FAB-01', name: 'Weaving Bar & Knitting Fly Flaw', category: 'WEAVING', departmentId: createdDepts.QC1.id, severity: 'MAJOR' },
      { code: 'DEF-STC-01', name: 'Skipped Needle Stitch / Seam Puckering', category: 'STITCHING', departmentId: createdDepts.QC3.id, severity: 'CRITICAL' },
      { code: 'DEF-CUT-01', name: 'Uneven Cut & Notch Misalignment', category: 'CUTTING', departmentId: createdDepts.QC2.id, severity: 'MAJOR' },
      { code: 'DEF-STN-01', name: 'Machine Oil Spot / Stain', category: 'FINISHING', departmentId: createdDepts.QC3.id, severity: 'MINOR' },
    ],
  });

  // 9. Design Master
  const designPolo = await prisma.design.create({
    data: {
      code: 'DES-9921',
      name: "Men's Mercerized Pima Pique Polo",
      designVersion: 'v1.0',
      season: 'Spring/Summer 2026',
      patternNumber: 'PAT-POLO-2026-M',
      category: 'POLO',
      description: 'Classic fit short-sleeve polo shirt with knitted collar and 2-button front placket.',
      customerId: customerZara.id,
    },
  });

  // 10. Program Master PRG-2026-0001
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + 30);

  const program = await prisma.program.create({
    data: {
      programNumber: 'PRG-2026-0001',
      programDate: new Date(),
      customerId: customerZara.id,
      buyerName: customerZara.name,
      orderNumber: 'PO-ZARA-78901',
      designId: designPolo.id,
      designName: designPolo.name,
      styleCode: 'POLO-SLIM-01',
      productCategory: 'Men Knitted Polo T-Shirt',
      targetQuantity: 1200,
      deliveryDate,
      priority: 'HIGH',
      status: 'APPROVED',
      createdById: createdUsers.admin.id,
      approvedById: createdUsers.prod_manager.id,
      approvedAt: new Date(),
      remarks: 'Certified Organic Pima Cotton. AQL 1.5 strict inspection required.',

      fabrics: {
        create: [
          {
            fabricId: fabricPique.id,
            fabricCode: fabricPique.code,
            fabricName: fabricPique.name,
            composition: fabricPique.composition,
            widthInInches: fabricPique.widthInInches,
            gsm: fabricPique.gsm,
            colourId: colRoyal.id,
            colour: colRoyal.name,
            shade: 'Dark Navy Tone',
            requiredQuantity: 650.0,
            tolerancePercentage: 3.5,
            wastagePercentage: 2.5,
          },
        ],
      },

      colours: {
        create: [
          { colourId: colRoyal.id, colorCode: colRoyal.code, colorName: colRoyal.name, shade: 'Shade-A', targetQuantity: 600 },
          { colourId: colOlive.id, colorCode: colOlive.code, colorName: colOlive.name, shade: 'Shade-B', targetQuantity: 600 },
        ],
      },

      sizes: {
        create: [
          { sizeId: sizeS.id, size: 'S', targetQuantity: 200 },
          { sizeId: sizeM.id, size: 'M', targetQuantity: 400 },
          { sizeId: sizeL.id, size: 'L', targetQuantity: 400 },
          { sizeId: sizeXL.id, size: 'XL', targetQuantity: 200 },
        ],
      },

      specifications: {
        create: [
          { sizeId: sizeS.id, size: 'S', length: 69.0, chest: 50.0, waist: 48.0, shoulder: 42.0, sleeveLength: 21.0, armhole: 23.0, neck: 38.0, bottom: 49.0 },
          { sizeId: sizeM.id, size: 'M', length: 71.0, chest: 53.0, waist: 51.0, shoulder: 44.0, sleeveLength: 22.0, armhole: 24.5, neck: 39.5, bottom: 52.0 },
          { sizeId: sizeL.id, size: 'L', length: 73.0, chest: 56.0, waist: 54.0, shoulder: 46.0, sleeveLength: 23.0, armhole: 26.0, neck: 41.0, bottom: 55.0 },
          { sizeId: sizeXL.id, size: 'XL', length: 75.0, chest: 59.0, waist: 57.0, shoulder: 48.0, sleeveLength: 24.0, armhole: 27.5, neck: 42.5, bottom: 58.0 },
        ],
      },

      bomItems: {
        create: [
          { itemCode: 'TRM-BTN-01', itemName: 'Laser Engraved 18L Resin Button', category: 'BUTTON', requiredQuantityPerPiece: 3.0, uom: 'PCS', wastagePercentage: 2.0, totalRequiredQuantity: 3672.0, supplierId: supplierCoats.id },
          { itemCode: 'TRM-THRD-01', itemName: 'Spun Polyester Sewing Thread 40/2', category: 'THREAD', requiredQuantityPerPiece: 120.0, uom: 'MTR', wastagePercentage: 5.0, totalRequiredQuantity: 151200.0, supplierId: supplierCoats.id },
          { itemCode: 'TRM-LBL-01', itemName: 'Damask Woven Brand Label', category: 'LABEL', requiredQuantityPerPiece: 1.0, uom: 'PCS', wastagePercentage: 1.0, totalRequiredQuantity: 1212.0 },
        ],
      },

      routes: {
        create: [
          {
            routeName: '17-Stage Full Standard Route',
            description: 'Store to Dispatch complete chain with 3 quality gates',
            isDefault: true,
            steps: {
              create: depts.map((d) => ({
                sequenceOrder: d.sequenceOrder,
                departmentCode: d.code,
                operationId: d.code === 'CUTTING' ? opCut.id : null,
                isMandatory: true,
                requiresQCGate: ['QC1', 'QC2', 'QC3'].includes(d.code),
                expectedDurationMinutes: 45.0,
                inputType: d.code === 'CUTTING' ? 'FABRIC_ROLL' : 'CUT_PANEL',
                outputType: d.code === 'CUTTING' ? 'CUT_PANEL' : 'PIECE',
                reworkAllowed: true,
                skipAllowed: false,
                isParallel: false,
              })),
            },
          },
        ],
      },
    },
  });

  // 11. Initial Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        actorId: createdUsers.admin.id,
        action: 'PROGRAM_CREATED',
        entity: 'Program',
        entityId: program.id,
        afterState: JSON.stringify({ programNumber: program.programNumber, targetQuantity: program.targetQuantity }),
        ipAddress: '127.0.0.1',
        userAgent: 'Subham-MES/Desktop-Client',
      },
      {
        actorId: createdUsers.prod_manager.id,
        action: 'PROGRAM_APPROVED',
        entity: 'Program',
        entityId: program.id,
        afterState: JSON.stringify({ status: 'APPROVED', approvedBy: createdUsers.prod_manager.username }),
        ipAddress: '127.0.0.1',
        userAgent: 'Subham-MES/Desktop-Client',
      },
    ],
  });

  console.log('=== SEEDING COMPLETED SUCCESSFULLY ON NEON POSTGRESQL ===');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
