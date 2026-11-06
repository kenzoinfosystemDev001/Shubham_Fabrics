const { PrismaClient } = require('@shubham/database');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Usernames are not unique (several incharges may share one), so "upsert" means: update the oldest account
// with that username, or create it when there is none.
async function upsertUser({ where, update, create }) {
  const existing = await prisma.user.findFirst({ where, orderBy: { createdAt: 'asc' } });
  return existing
    ? prisma.user.update({ where: { id: existing.id }, data: update })
    : prisma.user.create({ data: create });
}

async function setup() {
  console.log('--- Setting up core MES users (Admin, Programming, Fabric Store) ---');
  // PIN for users this script creates. Existing users keep their current PIN.
  const initialPin = (process.env.CORE_USER_PIN || '').trim();
  if (initialPin.length < 6 || ['123456', '000000', '111111'].includes(initialPin)) {
    throw new Error('Set CORE_USER_PIN to a non-trivial PIN of at least 6 characters before running this script.');
  }
  const hash = await bcrypt.hash(initialPin, 10);

  // 1. Departments. Users have no roles: their access comes from their department.
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
  const adminUser = await upsertUser({
    where: { username: 'admin' },
    update: { departmentCode: 'ADMIN', fullName: 'System Administrator' },
    create: {
      username: 'admin',
      email: 'admin@subhamfabrics.com',
      fullName: 'System Administrator',
      passwordHash: hash,
      departmentCode: 'ADMIN',
    },
  });
  console.log('✓ Admin user ready: admin');

  // 3. Programming User
  const progUser = await upsertUser({
    where: { username: 'program' },
    update: { departmentCode: 'PROGRAMMING', fullName: 'Programming Incharge' },
    create: {
      username: 'program',
      email: 'program@subhamfabrics.com',
      fullName: 'Programming Incharge',
      passwordHash: hash,
      departmentCode: 'PROGRAMMING',
    },
  });
  console.log('✓ Programming user ready: program');

  // 4. Fabric Store User
  const storeUser = await upsertUser({
    where: { username: 'store' },
    update: { departmentCode: 'STORE', fullName: 'Fabric Store Incharge' },
    create: {
      username: 'store',
      email: 'store@subhamfabrics.com',
      fullName: 'Fabric Store Incharge',
      passwordHash: hash,
      departmentCode: 'STORE',
    },
  });
  console.log('✓ Fabric Store user ready: store');


  // 5. QC Washing Department & User
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



  // washingqc is the Washing QC account; "qc3" and "qcwashing" are older sign-in names for it (lib/departments.ts).
  const existingQc3 =
    (await prisma.user.findFirst({ where: { username: 'washingqc' } })) || (await prisma.user.findFirst({ where: { username: 'qc3' } }));
  const qc3User = existingQc3
    ? await prisma.user.update({
        where: { id: existingQc3.id },
        data: { username: 'washingqc', departmentCode: 'QC3', fullName: 'Washing QC Incharge' },
      })
    : await prisma.user.create({
        data: {
          username: 'washingqc',
          email: 'washingqc@subhamfabrics.com',
          fullName: 'Washing QC Incharge',
          passwordHash: hash,
          departmentCode: 'QC3',
        },
      });
  console.log('✓ Washing QC user ready: washingqc');

  // 6. Recutting & Stitching Departments and User
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


  const recuttingUser = await upsertUser({
    where: { username: 'recutting' },
    update: { departmentCode: 'RECUTTING', fullName: 'Recutting Incharge' },
    create: {
      username: 'recutting',
      email: 'recutting@subhamfabrics.com',
      fullName: 'Recutting Incharge',
      passwordHash: hash,
      departmentCode: 'RECUTTING',
    },
  });
  console.log('✓ Recutting user ready: recutting');

  // 7. Stitching Department & User

  const stitchingUser = await upsertUser({
    where: { username: 'stitching' },
    update: { departmentCode: 'STITCHING', fullName: 'Stitching Incharge' },
    create: {
      username: 'stitching',
      email: 'stitching@subhamfabrics.com',
      fullName: 'Stitching Incharge',
      passwordHash: hash,
      departmentCode: 'STITCHING',
    },
  });
  console.log('✓ Stitching user ready: stitching');

  // 8. Finishing Department & User

  const finishingUser = await upsertUser({
    where: { username: 'finishing' },
    update: { departmentCode: 'FINISHING', fullName: 'Finishing Incharge' },
    create: {
      username: 'finishing',
      email: 'finishing@subhamfabrics.com',
      fullName: 'Finishing Incharge',
      passwordHash: hash,
      departmentCode: 'FINISHING',
    },
  });
  console.log('✓ Finishing user ready: finishing');

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

  const steamPressUser = await upsertUser({
    where: { username: 'steampress' },
    update: { departmentCode: 'STEAM_PRESS', fullName: 'Steam Press Incharge' },
    create: {
      username: 'steampress',
      email: 'steampress@subhamfabrics.com',
      fullName: 'Steam Press Incharge',
      passwordHash: hash,
      departmentCode: 'STEAM_PRESS',
    },
  });
  console.log('✓ Steam Press user ready: steampress');

  // 11. Final QC Department & User

  // finalqc is the Final QC account; "finalcheck" is its older sign-in name.
  const existingFinalCheck =
    (await prisma.user.findFirst({ where: { username: 'finalqc' } })) || (await prisma.user.findFirst({ where: { username: 'finalcheck' } }));
  const finalCheckUser = existingFinalCheck
    ? await prisma.user.update({
        where: { id: existingFinalCheck.id },
        data: { username: 'finalqc', departmentCode: 'FINAL_CHECK', fullName: 'Final QC Incharge' },
      })
    : await prisma.user.create({
        data: {
          username: 'finalqc',
          email: 'finalqc@subhamfabrics.com',
          fullName: 'Final QC Incharge',
          passwordHash: hash,
          departmentCode: 'FINAL_CHECK',
        },
      });
  console.log('✓ Final QC user ready: finalqc');

  // 12. Inventory Department & User (Packing is a module of Inventory, not a department).
  // An existing "packing" station user (the earlier Packing & Inventory department) is reused.
  await prisma.department.upsert({
    where: { code: 'INVENTORY' },
    update: { name: 'Inventory Department', sequenceOrder: 16 },
    create: { code: 'INVENTORY', name: 'Inventory Department', sequenceOrder: 16, description: 'Finished garment receipt, inventory and packing' },
  });


  const existingInventoryUser =
    (await prisma.user.findFirst({ where: { username: 'inventory' } })) || (await prisma.user.findFirst({ where: { username: 'packing' } }));
  const inventoryUser = existingInventoryUser
    ? await prisma.user.update({
        where: { id: existingInventoryUser.id },
        data: { username: 'inventory', departmentCode: 'INVENTORY', fullName: 'Inventory Incharge' },
      })
    : await prisma.user.create({
        data: {
          username: 'inventory',
          email: 'inventory@subhamfabrics.com',
          fullName: 'Inventory Incharge',
          passwordHash: hash,
          departmentCode: 'INVENTORY',
        },
      });
  console.log('✓ Inventory user ready: inventory');

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
