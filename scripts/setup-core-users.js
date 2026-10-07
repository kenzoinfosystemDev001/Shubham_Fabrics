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
