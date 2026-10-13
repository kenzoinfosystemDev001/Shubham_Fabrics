const path = require('path');
const { prisma } = require(path.resolve(__dirname, '../packages/database/dist/index.js'));
const bcrypt = require('bcryptjs');

async function clearAllData() {
  console.log('>>> [1/7] Clearing CartonBundle, Bundle, Carton...');
  await prisma.cartonBundle.deleteMany({});
  await prisma.bundle.deleteMany({});
  await prisma.carton.deleteMany({});

  console.log('>>> [2/7] Clearing Production, Quality, Defects, Ledgers...');
  await prisma.productionTransaction.deleteMany({});
  await prisma.qualityInspection.deleteMany({});
  await prisma.defectRecord.deleteMany({});
  await prisma.reworkTransaction.deleteMany({});
  await prisma.recutRequest.deleteMany({});
  await prisma.stockLedgerEntry.deleteMany({});

  console.log('>>> [3/7] Clearing Dyeing Orders...');
  await prisma.dyeingOrder.deleteMany({});

  console.log('>>> [4/7] Clearing Challans & Events...');
  await prisma.challan.updateMany({ data: { parentChallanId: null } });
  await prisma.challanItem.deleteMany({});
  await prisma.challanEvent.deleteMany({});
  await prisma.challan.deleteMany({});

  console.log('>>> [5/7] Clearing Fabric Rolls & Batches...');
  await prisma.fabricStoreRoll.deleteMany({});
  await prisma.fabricRoll.deleteMany({});
  await prisma.fabricBatch.deleteMany({});

  console.log('>>> [6/7] Clearing Programs & Specifications...');
  await prisma.programRouteStep.deleteMany({});
  await prisma.programRoute.deleteMany({});
  await prisma.programBOM.deleteMany({});
  await prisma.programSpecification.deleteMany({});
  await prisma.programSize.deleteMany({});
  await prisma.programColour.deleteMany({});
  await prisma.programFabric.deleteMany({});
  await prisma.program.deleteMany({});

  console.log('>>> [7/7] Clearing Attachments & Audit Logs...');
  await prisma.attachment.deleteMany({});
  await prisma.auditLog.deleteMany({});

  console.log('>>> Ensuring Core Users (admin, program, store, dyeing) are active...');
  const hashedPin = await bcrypt.hash('1234', 10);

  const departments = [
    { code: 'ADMIN', name: 'Administration', sequenceOrder: 0 },
    { code: 'PROGRAMMING', name: 'Programming Department', sequenceOrder: 1 },
    { code: 'STORE', name: 'Fabric Store Department', sequenceOrder: 2 },
    { code: 'DYEING', name: 'Dyeing Department', sequenceOrder: 3 },
    { code: 'EMBROIDERY', name: 'Embroidery Department', sequenceOrder: 4 },
    { code: 'QC1', name: 'Quality Control 1', sequenceOrder: 5 },
    { code: 'FINISHING', name: 'Finishing & Packing', sequenceOrder: 6 },
  ];

  for (const d of departments) {
    await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name },
      create: d,
    });
  }

  const roles = [
    { code: 'ADMIN', name: 'System Administrator' },
    { code: 'PROGRAMMING_INCHARGE', name: 'Programming Incharge' },
    { code: 'FABRIC_STORE', name: 'Fabric Store Incharge' },
    { code: 'DYEING_INCHARGE', name: 'Dyeing Incharge' },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name },
      create: { code: r.code, name: r.name, isSystem: true },
    });
  }

  const coreUsers = [
    { username: 'admin', fullName: 'System Administrator', email: 'admin@subhamfabrics.com', role: 'ADMIN', dept: 'ADMIN' },
    { username: 'program', fullName: 'Programming Department', email: 'programming@subhamfabrics.com', role: 'PROGRAMMING_INCHARGE', dept: 'PROGRAMMING' },
    { username: 'store', fullName: 'Fabric Store Department', email: 'store@subhamfabrics.com', role: 'FABRIC_STORE', dept: 'STORE' },
    { username: 'dyeing', fullName: 'Dyeing Incharge', email: 'dyeing@subhamfabrics.com', role: 'DYEING_INCHARGE', dept: 'DYEING' },
  ];

  for (const u of coreUsers) {
    const existing = await prisma.user.findFirst({ where: { username: u.username } });
    if (!existing) {
      const created = await prisma.user.create({
        data: {
          username: u.username,
          fullName: u.fullName,
          email: u.email,
          passwordHash: hashedPin,
          departmentCode: u.dept,
          isActive: true,
        },
      });
      const role = await prisma.role.findFirst({ where: { code: u.role } });
      if (role) {
        await prisma.userRole.create({
          data: { userId: created.id, roleId: role.id },
        });
      }
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash: hashedPin,
          departmentCode: u.dept,
          isActive: true,
        },
      });
    }
  }

  const programs = await prisma.program.count();
  const challans = await prisma.challan.count();
  const dyeing = await prisma.dyeingOrder.count();
  const rolls = await prisma.fabricStoreRoll.count();
  const users = await prisma.user.count();

  console.log('SUCCESS! ALL TRANSACTIONAL DATA CLEARED:');
  console.log(`- Programs remaining: ${programs}`);
  console.log(`- Challans remaining: ${challans}`);
  console.log(`- Dyeing Orders remaining: ${dyeing}`);
  console.log(`- Fabric Rolls remaining: ${rolls}`);
  console.log(`- Active Core Users: ${users}`);

  await prisma.$disconnect();
}

clearAllData().catch((e) => {
  console.error('FAILED TO CLEAR DATA:', e);
  process.exit(1);
});
