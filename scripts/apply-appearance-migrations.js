// Applies the manual database migrations (packages/database/prisma/manual-migrations) that this version of
// the app needs, each ONCE: applied files are recorded in the "_manual_migrations" table, so later runs only
// check that table. A file is applied again only if its contents change (every file is re-runnable).
//
// Runs automatically before the web app starts (apps/web "predev" / "prestart", with --soft), so a newly
// added migration reaches the database without anyone having to remember a command. It can also be run by
// hand from the Shubham_Fabrics folder:  node scripts/apply-appearance-migrations.js
//
// Flags:  --soft   never fail the caller (prints the problem and exits 0, so the app still starts)
//         --force  apply every file again
//         --vercel-production  run only in a Vercel production build (VERCEL_ENV=production) and skip
//                  everywhere else. apps/web "prebuild" uses it, so a production deploy applies its
//                  migrations before the new code goes live; preview builds of unmerged branches never
//                  change the shared database. A failure fails the build, so code never ships ahead of
//                  its database.
//
// All files are additive and re-runnable except 20261026_inventory_department.sql, which moves records from
// the department code PACKING to INVENTORY (see that file; it applies all-or-nothing).
// DATABASE_URL comes from the environment, else apps/api/.env, else apps/web/.env.local.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const MIGRATIONS_DIR = path.join(root, 'packages', 'database', 'prisma', 'manual-migrations');
const MIGRATIONS = [
  '20261024_deadline_alerts.sql',
  '20261024_production_fixes.sql',
  '20261025_department_images.sql',
  '20261025_branding_assets.sql',
  '20261025_app_settings.sql',
  '20261025_dyeing_workflow.sql',
  '20261025_department_work_items.sql',
  '20261025_threadcut_qc.sql',
  '20261025_recutting_allocation.sql',
  '20261025_stitching_production.sql',
  '20261025_work_item_source.sql',
  '20261026_inventory_packing.sql',
  '20261026_inventory_department.sql',
  '20261026_stock_imports.sql',
  '20261026_grn_unit.sql',
  '20261026_mtr_pcs_per_item.sql',
  '20261027_inward_bill_details.sql',
  '20261028_challan_item_average.sql',
  '20261028_qc_station_usernames.sql',
  '20261028_challan_number_per_department.sql',
  '20261028_incharge_name.sql',
  '20261028_shrinkage.sql',
  '20261028_fabric_photos.sql',
  '20261029_challan_item_unit_quantity.sql',
];

const args = new Set(process.argv.slice(2));
const SOFT = args.has('--soft');
const FORCE = args.has('--force');

if (args.has('--vercel-production') && process.env.VERCEL_ENV !== 'production') {
  console.log(`[migrations] Skipped: not a Vercel production build (VERCEL_ENV=${process.env.VERCEL_ENV || 'unset'}).`);
  process.exit(0);
}

function fail(message) {
  console.error(`\n[migrations] ${message}`);
  if (SOFT) {
    console.error('[migrations] The app will start, but screens that need these tables will show a setup message.');
    console.error('[migrations] Fix the problem above, then run: node scripts/apply-appearance-migrations.js\n');
    process.exit(0);
  }
  process.exit(1);
}

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const file of [path.join(root, 'apps', 'api', '.env'), path.join(root, 'apps', 'web', '.env.local')]) {
    if (!fs.existsSync(file)) continue;
    const line = fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .find((l) => /^\s*DATABASE_URL\s*=/.test(l));
    const value = line ? line.replace(/^\s*DATABASE_URL\s*=\s*/, '').trim().replace(/^['"]|['"]$/g, '') : '';
    if (value) return value;
  }
  return null;
}

const checksumOf = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(MIGRATIONS_DIR, file))).digest('hex');

async function main() {
  const url = readDatabaseUrl();
  if (!url) return fail('DATABASE_URL is not set (environment, apps/api/.env or apps/web/.env.local).');
  process.env.DATABASE_URL = url;

  let prisma;
  try {
    ({ prisma } = require(path.join(root, 'packages', 'database', 'dist', 'index.js')));
  } catch (error) {
    return fail(`The database package is not built (${error.message.split('\n')[0]}). Run: npm run build --workspace=packages/database`);
  }

  let applied;
  try {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS "_manual_migrations" ("name" TEXT PRIMARY KEY, "checksum" TEXT NOT NULL, "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    );
    const rows = await prisma.$queryRawUnsafe('SELECT "name", "checksum" FROM "_manual_migrations"');
    applied = new Map(rows.map((r) => [r.name, r.checksum]));
  } catch (error) {
    await prisma.$disconnect().catch(() => {});
    return fail(`Could not reach the database to check migrations: ${String(error.message).split('\n').filter(Boolean).slice(-1)[0]}`);
  }

  const pending = MIGRATIONS.filter((file) => FORCE || applied.get(file) !== checksumOf(file));
  if (pending.length === 0) {
    console.log(`[migrations] Database is up to date (${MIGRATIONS.length} migrations applied).`);
    await prisma.$disconnect();
    return;
  }

  console.log(`[migrations] Applying ${pending.length} migration(s) on ${new URL(url).host} ...`);
  for (const file of pending) {
    console.log(`\n> ${file}`);
    const result = spawnSync(
      'npx',
      ['prisma', 'db', 'execute', '--schema', 'prisma/schema.prisma', '--file', `prisma/manual-migrations/${file}`],
      { cwd: path.join(root, 'packages', 'database'), stdio: 'inherit', shell: true, env: { ...process.env, DATABASE_URL: url } },
    );
    if (result.status !== 0) {
      await prisma.$disconnect().catch(() => {});
      return fail(`${file} did not complete; nothing after it was applied.`);
    }
    await prisma.$executeRawUnsafe(
      'INSERT INTO "_manual_migrations" ("name", "checksum", "appliedAt") VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT ("name") DO UPDATE SET "checksum" = EXCLUDED."checksum", "appliedAt" = EXCLUDED."appliedAt"',
      file,
      checksumOf(file),
    );
  }
  await prisma.$disconnect();
  console.log('\n[migrations] Done. The database matches this version of the app.');
}

main().catch((error) => fail(error && error.message ? error.message : String(error)));
