// Loads the bundled sidebar artwork (assets/department-images/*.png) into the DepartmentImage table.
// Departments that already have an image are left alone unless --force is passed.
// Usage: node scripts/seed-department-images.js [--force]
// Needs DATABASE_URL and the 20261025_department_images.sql migration applied.
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@subham/database');

const prisma = new PrismaClient();
const force = process.argv.includes('--force');
const assetDir = path.join(__dirname, '..', 'assets', 'department-images');

// Codes and names match SIDEBAR_DEPARTMENTS in apps/web/src/lib/department-images.ts.
const IMAGES = [
  { code: 'PROGRAMMING', name: 'Programming Department', file: 'programming.png', alt: 'Garment pattern pieces with pins and measuring tape on lavender fabric' },
  { code: 'STORE', name: 'Fabric Store Department', file: 'store.png', alt: 'Neatly stacked fabric rolls in soft colours' },
  { code: 'DYEING', name: 'Dyeing Department', file: 'dyeing.png', alt: 'Freshly dyed fabric lengths hanging from a rail' },
  { code: 'QC1', name: 'Dyeing QC', file: 'qc1.png', alt: 'Shade card and magnifier checking dyed fabric' },
  { code: 'EMBROIDERY', name: 'Embroidery Department', file: 'embroidery.png', alt: 'Floral embroidery stretched in a wooden hoop' },
  { code: 'THREAD_CUTTING', name: 'Thread Cutting Department', file: 'thread-cutting.png', alt: 'Thread spools and scissors trimming loose threads' },
  { code: 'QC2', name: 'Threadcut QC (QC2)', file: 'qc2.png', alt: 'Magnifier inspecting a stitched seam' },
  { code: 'WASHING', name: 'Washing Department', file: 'washing.png', alt: 'Soft washed fabric waves with bubbles' },
  { code: 'QC3', name: 'Washing QC (QC3)', file: 'qc3.png', alt: 'Folded washed garments with an approved inspection tag' },
  { code: 'RECUTTING', name: 'Recutting Department', file: 'recutting.png', alt: 'Fabric sheet marked with pattern pieces and a cutting line' },
  { code: 'STITCHING', name: 'Stitching Department', file: 'stitching.png', alt: 'Needle and thread sewing a seam between fabric panels' },
  { code: 'FINISHING', name: 'Finishing Department', file: 'finishing.png', alt: 'Garment placket with buttons and a lace edge' },
  { code: 'STEAM_PRESS', name: 'Steam Press Department', file: 'steam-press.png', alt: 'Steam iron pressing smooth fabric' },
  { code: 'FINAL_CHECK', name: 'Final QC', file: 'final-check.png', alt: 'Finished kurta on a hanger with an approved QC tag' },
  { code: 'INVENTORY', name: 'Inventory Department', file: 'packing.png', alt: 'Folded garments beside a ribbon-tied packing box' },
];

async function main() {
  let created = 0;
  let replaced = 0;
  let skipped = 0;

  for (const [index, item] of IMAGES.entries()) {
    const bytes = fs.readFileSync(path.join(assetDir, item.file));
    const department = await prisma.department.upsert({
      where: { code: item.code },
      update: {},
      create: { code: item.code, name: item.name, sequenceOrder: index + 1 },
      select: { id: true },
    });

    const existing = await prisma.departmentImage.findUnique({
      where: { departmentId: department.id },
      select: { id: true, fileName: true, storageProvider: true },
    });
    if (existing && !force) {
      console.log(`skip     ${item.code.padEnd(15)} already has ${existing.fileName}`);
      skipped++;
      continue;
    }

    const fields = {
      storageProvider: 'DATABASE',
      storageKey: null,
      imageUrl: null,
      imageData: bytes,
      mimeType: 'image/png',
      fileName: item.file,
      fileSize: bytes.length,
      altText: item.alt,
      isActive: true,
    };
    await prisma.departmentImage.upsert({
      where: { departmentId: department.id },
      create: { departmentId: department.id, ...fields },
      update: { ...fields, version: { increment: 1 } },
    });

    if (existing) {
      replaced++;
      const note = existing.storageProvider === 'CLOUDINARY' ? ' (previous Cloudinary asset left in place)' : '';
      console.log(`replace  ${item.code.padEnd(15)} ${item.file}${note}`);
    } else {
      created++;
      console.log(`create   ${item.code.padEnd(15)} ${item.file}`);
    }
  }

  console.log(`\nDone: ${created} created, ${replaced} replaced, ${skipped} skipped.`);
}

main()
  .catch((error) => {
    console.error('Seeding department images failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
