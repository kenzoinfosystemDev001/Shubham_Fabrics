const { PrismaClient } = require('@subham/database');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function setup() {
  console.log('--- Setting up core MES users (Admin, Programming, Fabric Store) ---');
  const hash = await bcrypt.hash('1234', 10);

  // 1. Ensure Roles
  let adminRole = await prisma.role.findFirst({ where: { code: 'ADMIN' } });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: { code: 'ADMIN', name: 'Administrator', description: 'Full MES system access', isSystem: true },
    });
  }

  let progRole = await prisma.role.findFirst({ where: { code: 'PROGRAMMING_INCHARGE' } });
  if (!progRole) {
    progRole = await prisma.role.create({
      data: { code: 'PROGRAMMING_INCHARGE', name: 'Programming Incharge', description: 'Programming department head', isSystem: true },
    });
  }

  let storeRole = await prisma.role.findFirst({ where: { code: 'FABRIC_STORE' } });
  if (!storeRole) {
    storeRole = await prisma.role.create({
      data: { code: 'FABRIC_STORE', name: 'Fabric Store Incharge', description: 'Fabric store operations and inventory', isSystem: true },
    });
  }

  // Ensure Departments
  await prisma.department.upsert({
    where: { code: 'ADMIN' },
    update: { name: 'Administration' },
    create: { code: 'ADMIN', name: 'Administration', sequenceOrder: 0 },
  });
  await prisma.department.upsert({
    where: { code: 'PROGRAMMING' },
    update: { name: 'Programming Department' },
    create: { code: 'PROGRAMMING', name: 'Programming Department', sequenceOrder: 1 },
  });
  await prisma.department.upsert({
    where: { code: 'STORE' },
    update: { name: 'Fabric Store' },
    create: { code: 'STORE', name: 'Fabric Store', sequenceOrder: 2 },
  });

  // 2. Admin User
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: hash, departmentCode: 'ADMIN', fullName: 'System Administrator' },
    create: {
      username: 'admin',
      email: 'admin@subhamfabrics.com',
      fullName: 'System Administrator',
      passwordHash: hash,
      departmentCode: 'ADMIN',
    },
  });
  let superAdminRole = await prisma.role.findFirst({ where: { code: 'SUPER_ADMIN' } });
  if (!superAdminRole) {
    superAdminRole = await prisma.role.create({
      data: { code: 'SUPER_ADMIN', name: 'Super Administrator', isSystem: true },
    });
  }
  const adminHash = await bcrypt.hash('Admin@12345', 10);
  await prisma.user.update({ where: { id: adminUser.id }, data: { passwordHash: adminHash } });
  await prisma.userRole.deleteMany({ where: { userId: adminUser.id } });
  await prisma.userRole.create({ data: { userId: adminUser.id, roleId: superAdminRole.id } });
  await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });
  console.log('✓ Admin user ready: admin / 1234 (SUPER_ADMIN)');

  // 3. Programming User
  const progUser = await prisma.user.upsert({
    where: { username: 'program' },
    update: { passwordHash: hash, departmentCode: 'PROGRAMMING', fullName: 'Programming Department' },
    create: {
      username: 'program',
      email: 'program@subhamfabrics.com',
      fullName: 'Programming Department',
      passwordHash: hash,
      departmentCode: 'PROGRAMMING',
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: progUser.id } });
  await prisma.userRole.create({ data: { userId: progUser.id, roleId: progRole.id } });
  console.log('✓ Programming user ready: program / 1234');

  // 4. Fabric Store User
  const storeUser = await prisma.user.upsert({
    where: { username: 'store' },
    update: { passwordHash: hash, departmentCode: 'STORE', fullName: 'Fabric Store Department' },
    create: {
      username: 'store',
      email: 'store@subhamfabrics.com',
      fullName: 'Fabric Store Department',
      passwordHash: hash,
      departmentCode: 'STORE',
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: storeUser.id } });
  await prisma.userRole.create({ data: { userId: storeUser.id, roleId: storeRole.id } });
  console.log('✓ Fabric Store user ready: store / 1234');

  // Also support alias 'programmer' for backward compatibility
  const programmerUser = await prisma.user.findFirst({ where: { username: 'programmer' } });
  if (programmerUser) {
    await prisma.user.update({
      where: { id: programmerUser.id },
      data: { passwordHash: hash },
    });
    console.log('✓ Programmer alias PIN updated to 1234');
  }

  // 5. QC Washing Department & Role & User
  await prisma.department.upsert({
    where: { code: 'QC3' },
    update: { name: 'QC Washing', sequenceOrder: 8 },
    create: { code: 'QC3', name: 'QC Washing', sequenceOrder: 8, description: 'QC Washing Inspection Department' },
  });

  await prisma.department.upsert({
    where: { code: 'QCWASHING' },
    update: { name: 'QC Washing', sequenceOrder: 8 },
    create: { code: 'QCWASHING', name: 'QC Washing', sequenceOrder: 8, description: 'QC Washing Inspection Department' },
  });

  let qcWashingRole = await prisma.role.findFirst({ where: { code: 'QC3_INSPECTOR' } });
  if (!qcWashingRole) {
    qcWashingRole = await prisma.role.create({
      data: { code: 'QC3_INSPECTOR', name: 'QC Washing Inspector', description: 'QC Washing inspection & verification', isSystem: true },
    });
  }

  let qcInspectorRole = await prisma.role.findFirst({ where: { code: 'QC_INSPECTOR' } });
  if (!qcInspectorRole) {
    qcInspectorRole = await prisma.role.create({
      data: { code: 'QC_INSPECTOR', name: 'Quality Inspector', description: 'General QC Inspector', isSystem: true },
    });
  }

  const qcwashingUser = await prisma.user.upsert({
    where: { username: 'qcwashing' },
    update: { passwordHash: hash, departmentCode: 'QC3', fullName: 'QC Washing Inspector' },
    create: {
      username: 'qcwashing',
      email: 'qcwashing@subhamfabrics.com',
      fullName: 'QC Washing Inspector',
      passwordHash: hash,
      departmentCode: 'QC3',
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: qcwashingUser.id } });
  await prisma.userRole.create({ data: { userId: qcwashingUser.id, roleId: qcWashingRole.id } });
  await prisma.userRole.create({ data: { userId: qcwashingUser.id, roleId: qcInspectorRole.id } });
  console.log('✓ QC Washing user ready: qcwashing / 1234 (QC3_INSPECTOR)');

  // Also support alias 'qc3'
  const qc3User = await prisma.user.upsert({
    where: { username: 'qc3' },
    update: { passwordHash: hash, departmentCode: 'QC3', fullName: 'QC Washing Inspector' },
    create: {
      username: 'qc3',
      email: 'qc3@subhamfabrics.com',
      fullName: 'QC Washing Inspector',
      passwordHash: hash,
      departmentCode: 'QC3',
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: qc3User.id } });
  await prisma.userRole.create({ data: { userId: qc3User.id, roleId: qcWashingRole.id } });
  console.log('✓ QC Washing alias ready: qc3 / 1234');

  // 6. Recutting & Stitching Departments, Roles, and User
  await prisma.department.upsert({
    where: { code: 'RECUTTING' },
    update: { name: 'Embroidery Recutting', sequenceOrder: 10 },
    create: { code: 'RECUTTING', name: 'Embroidery Recutting', sequenceOrder: 10, description: 'Embroidery & Panel Recutting Section' },
  });

  await prisma.department.upsert({
    where: { code: 'STITCHING' },
    update: { name: 'Stitching Department', sequenceOrder: 11 },
    create: { code: 'STITCHING', name: 'Stitching Department', sequenceOrder: 11, description: 'Garment Assembly & Stitching Lines' },
  });

  let recuttingRole = await prisma.role.findFirst({ where: { code: 'RECUTTING_SUPERVISOR' } });
  if (!recuttingRole) {
    recuttingRole = await prisma.role.create({
      data: { code: 'RECUTTING_SUPERVISOR', name: 'Recutting Supervisor', description: 'Embroidery recutting and panel separation supervisor', isSystem: true },
    });
  }

  const recuttingUser = await prisma.user.upsert({
    where: { username: 'recutting' },
    update: { passwordHash: hash, departmentCode: 'RECUTTING', fullName: 'Recutting Incharge' },
    create: {
      username: 'recutting',
      email: 'recutting@subhamfabrics.com',
      fullName: 'Recutting Incharge',
      passwordHash: hash,
      departmentCode: 'RECUTTING',
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: recuttingUser.id } });
  await prisma.userRole.create({ data: { userId: recuttingUser.id, roleId: recuttingRole.id } });
  console.log('✓ Recutting user ready: recutting / 1234 (RECUTTING_SUPERVISOR)');

  // 7. Stitching Department & Role & User
  let stitchingRole = await prisma.role.findFirst({ where: { code: 'STITCHING_SUPERVISOR' } });
  if (!stitchingRole) {
    stitchingRole = await prisma.role.create({
      data: { code: 'STITCHING_SUPERVISOR', name: 'Stitching Supervisor', description: 'Garment assembly and stitching line supervisor', isSystem: true },
    });
  }

  const stitchingUser = await prisma.user.upsert({
    where: { username: 'stitching' },
    update: { passwordHash: hash, departmentCode: 'STITCHING', fullName: 'Stitching Incharge' },
    create: {
      username: 'stitching',
      email: 'stitching@subhamfabrics.com',
      fullName: 'Stitching Incharge',
      passwordHash: hash,
      departmentCode: 'STITCHING',
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: stitchingUser.id } });
  await prisma.userRole.create({ data: { userId: stitchingUser.id, roleId: stitchingRole.id } });
  console.log('✓ Stitching user ready: stitching / 1234 (STITCHING_SUPERVISOR)');

  // 8. Finishing Department & Role & User
  let finishingRole = await prisma.role.findFirst({ where: { code: 'FINISHING_SUPERVISOR' } });
  if (!finishingRole) {
    finishingRole = await prisma.role.create({
      data: { code: 'FINISHING_SUPERVISOR', name: 'Finishing Supervisor', description: 'Garment finishing, trimming, and pressing supervisor', isSystem: true },
    });
  }

  const finishingUser = await prisma.user.upsert({
    where: { username: 'finishing' },
    update: { passwordHash: hash, departmentCode: 'FINISHING', fullName: 'Finishing Incharge' },
    create: {
      username: 'finishing',
      email: 'finishing@subhamfabrics.com',
      fullName: 'Finishing Incharge',
      passwordHash: hash,
      departmentCode: 'FINISHING',
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: finishingUser.id } });
  await prisma.userRole.create({ data: { userId: finishingUser.id, roleId: finishingRole.id } });
  console.log('✓ Finishing user ready: finishing / 1234 (FINISHING_SUPERVISOR)');

  // 9. Downstream factory route departments
  await prisma.department.upsert({
    where: { code: 'BUTTON_ATTACHMENT' },
    update: { name: 'Button & Trim Attachment', sequenceOrder: 13 },
    create: { code: 'BUTTON_ATTACHMENT', name: 'Button & Trim Attachment', sequenceOrder: 13, description: 'Button stitching and trim fixing section' },
  });

  await prisma.department.upsert({
    where: { code: 'STEAM_PRESS' },
    update: { name: 'Steam Pressing', sequenceOrder: 14 },
    create: { code: 'STEAM_PRESS', name: 'Steam Pressing', sequenceOrder: 14, description: 'Boiler steam pressing and crease setting' },
  });

  await prisma.department.upsert({
    where: { code: 'FINISHED_GOODS' },
    update: { name: 'Finished Goods Warehouse', sequenceOrder: 17 },
    create: { code: 'FINISHED_GOODS', name: 'Finished Goods Warehouse', sequenceOrder: 17, description: 'Finished goods storage warehouse' },
  });

  await prisma.department.upsert({
    where: { code: 'DISPATCH' },
    update: { name: 'Dispatch Department', sequenceOrder: 18 },
    create: { code: 'DISPATCH', name: 'Dispatch Department', sequenceOrder: 18, description: 'Shipping and logistics dispatch' },
  });

  // 10. Steam Press Department & User
  let steamPressRole = await prisma.role.findFirst({ where: { code: 'STEAM_PRESS_SUPERVISOR' } });
  if (!steamPressRole) {
    steamPressRole = await prisma.role.create({
      data: { code: 'STEAM_PRESS_SUPERVISOR', name: 'Steam Press Supervisor', description: 'Steam pressing, ironing, and crease setting supervisor', isSystem: true },
    });
  }

  const steamPressUser = await prisma.user.upsert({
    where: { username: 'steampress' },
    update: { passwordHash: hash, departmentCode: 'STEAM_PRESS', fullName: 'Steam Press Incharge' },
    create: {
      username: 'steampress',
      email: 'steampress@subhamfabrics.com',
      fullName: 'Steam Press Incharge',
      passwordHash: hash,
      departmentCode: 'STEAM_PRESS',
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: steamPressUser.id } });
  await prisma.userRole.create({ data: { userId: steamPressUser.id, roleId: steamPressRole.id } });
  console.log('✓ Steam Press user ready: steampress / 1234 (STEAM_PRESS_SUPERVISOR)');

  // 11. Final QC Department & User
  let finalCheckRole = await prisma.role.findFirst({ where: { code: 'FINAL_CHECK_INSPECTOR' } });
  if (!finalCheckRole) {
    finalCheckRole = await prisma.role.create({
      data: { code: 'FINAL_CHECK_INSPECTOR', name: 'Final QC Inspector', description: 'Final garment inspection and quality verification', isSystem: true },
    });
  }

  const finalCheckUser = await prisma.user.upsert({
    where: { username: 'finalcheck' },
    update: { passwordHash: hash, departmentCode: 'FINAL_CHECK', fullName: 'Final QC Inspector' },
    create: {
      username: 'finalcheck',
      email: 'finalcheck@subhamfabrics.com',
      fullName: 'Final QC Inspector',
      passwordHash: hash,
      departmentCode: 'FINAL_CHECK',
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: finalCheckUser.id } });
  await prisma.userRole.create({ data: { userId: finalCheckUser.id, roleId: finalCheckRole.id } });
  console.log('✓ Final QC user ready: finalcheck / 1234 (FINAL_CHECK_INSPECTOR)');

  console.log('✓ Downstream factory route departments verified');

  console.log('--- Core users successfully configured ---');
}

setup()
  .catch((err) => {
    console.error('Failed to setup users:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
