/**
 * QC department rename migration.
 *
 *   QC1                         -> DYEING_QC     (Dyeing QC)
 *   QC2                         -> THREADCUT_QC  (Threadcut QC)
 *   QC3, QCWASHING, QC_WASHING  -> WASHING_QC    (Washing QC; the duplicate department rows are merged)
 *   FINAL_CHECK                 -> FINAL_QC      (Final QC)
 *
 * Department and role rows are renamed in place so their ids stay stable; duplicate rows are merged
 * into the surviving row and removed. Department codes stored on challans, users, stock, defects and
 * production records are rewritten, along with defective-shelf codes and Dyeing order statuses.
 * Audit history (challan events, audit logs, remarks) and issued challan numbers are not modified.
 *
 * Idempotent: running it again after a successful run changes nothing.
 * Run it before deploying the application build that uses the new codes.
 *
 *   node scripts/migrate-qc-departments.js --dry-run   # report what would change, then roll back
 *   node scripts/migrate-qc-departments.js             # apply
 */
const { PrismaClient } = require('@subham/database');

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

const DEPARTMENTS = [
  { code: 'DYEING_QC', name: 'Dyeing QC', sequenceOrder: 4, legacy: ['QC1'] },
  { code: 'THREADCUT_QC', name: 'Threadcut QC', sequenceOrder: 7, legacy: ['QC2'] },
  { code: 'WASHING_QC', name: 'Washing QC', sequenceOrder: 9, legacy: ['QC3', 'QCWASHING', 'QC_WASHING'] },
  { code: 'FINAL_QC', name: 'Final QC', sequenceOrder: 14, legacy: ['FINAL_CHECK'] },
];

const ROLES = [
  { code: 'DYEING_QC_INSPECTOR', name: 'Dyeing QC Inspector', legacy: ['QC1_INSPECTOR'] },
  { code: 'THREADCUT_QC_INSPECTOR', name: 'Threadcut QC Inspector', legacy: ['QC2_INSPECTOR'] },
  { code: 'WASHING_QC_INSPECTOR', name: 'Washing QC Inspector', legacy: ['QC3_INSPECTOR', 'QCWASHING_INSPECTOR'] },
  { code: 'FINAL_QC_INSPECTOR', name: 'Final QC Inspector', legacy: ['FINAL_CHECK_INSPECTOR'] },
  { code: 'FINAL_QC_SUPERVISOR', name: 'Final QC Supervisor', legacy: ['FINAL_CHECK_SUPERVISOR'] },
];

const SHELF_CODES = {
  'DEF-SHELF-QC1': 'DEF-SHELF-DYEING-QC',
  'DEF-SHELF-QC2': 'DEF-SHELF-THREADCUT-QC',
  'DEF-SHELF-QC3': 'DEF-SHELF-WASHING-QC',
  'DEF-SHELF-FINAL-CHECK': 'DEF-SHELF-FINAL-QC',
};

const DYEING_ORDER_STATUSES = {
  READY_FOR_QC1: 'READY_FOR_DYEING_QC',
  SENT_TO_QC1: 'SENT_TO_DYEING_QC',
};

// Plain (non-foreign-key) columns that hold a department code.
const DEPARTMENT_CODE_COLUMNS = [
  ['user', 'departmentCode'],
  ['programRouteStep', 'departmentCode'],
  ['challan', 'detectedFromDepartment'],
  ['productionTransaction', 'departmentCode'],
  ['qualityInspection', 'departmentCode'],
  ['stockLedgerEntry', 'departmentCode'],
  ['bundle', 'currentDepartment'],
  ['defectRecord', 'departmentCode'],
  ['reworkTransaction', 'departmentCode'],
];

class DryRunRollback extends Error {}

const report = [];
function record(label, count) {
  if (count > 0) report.push(`  ${label}: ${count}`);
}

/** Challan.fromDepartment/toDepartment reference Department.code; renaming in place needs ON UPDATE CASCADE. */
async function challanForeignKeysCascade(tx) {
  const rules = await tx.$queryRaw`
    SELECT DISTINCT rc.update_rule
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage k
      ON k.constraint_name = rc.constraint_name AND k.constraint_schema = rc.constraint_schema
    WHERE k.table_name = 'Challan' AND k.column_name IN ('fromDepartment', 'toDepartment')`;
  return rules.length > 0 && rules.every((r) => r.update_rule === 'CASCADE');
}

async function migrateDepartment(tx, target, renameInPlace) {
  const { code, name, sequenceOrder, legacy } = target;
  const legacyRows = await tx.department.findMany({ where: { code: { in: legacy } } });
  legacyRows.sort((a, b) => legacy.indexOf(a.code) - legacy.indexOf(b.code));

  let canonical = await tx.department.findUnique({ where: { code } });
  let mergeRows = legacyRows;

  if (!canonical && legacyRows.length > 0 && renameInPlace) {
    // Keep the first legacy row (and its id); challan codes follow through ON UPDATE CASCADE.
    const primary = legacyRows[0];
    canonical = await tx.department.update({ where: { id: primary.id }, data: { code, name } });
    record(`Department ${primary.code} renamed to ${code}`, 1);
    mergeRows = legacyRows.slice(1);
  } else if (!canonical) {
    const template = legacyRows[0];
    canonical = await tx.department.create({
      data: {
        code,
        name,
        sequenceOrder: template?.sequenceOrder ?? sequenceOrder,
        description: template?.description ?? null,
        isActive: template?.isActive ?? true,
      },
    });
    record(`Department ${code} created`, 1);
  } else if (canonical.name !== name) {
    await tx.department.update({ where: { id: canonical.id }, data: { name } });
  }

  if (mergeRows.length === 0) return;
  const codes = mergeRows.map((r) => r.code);
  const ids = mergeRows.map((r) => r.id);

  record(`Challan.fromDepartment ${codes.join('/')} -> ${code}`,
    (await tx.challan.updateMany({ where: { fromDepartment: { in: codes } }, data: { fromDepartment: code } })).count);
  record(`Challan.toDepartment ${codes.join('/')} -> ${code}`,
    (await tx.challan.updateMany({ where: { toDepartment: { in: codes } }, data: { toDepartment: code } })).count);
  record(`WorkCenter re-pointed to ${code}`,
    (await tx.workCenter.updateMany({ where: { departmentId: { in: ids } }, data: { departmentId: canonical.id } })).count);
  record(`Operation re-pointed to ${code}`,
    (await tx.operation.updateMany({ where: { departmentId: { in: ids } }, data: { departmentId: canonical.id } })).count);
  record(`DefectCode re-pointed to ${code}`,
    (await tx.defectCode.updateMany({ where: { departmentId: { in: ids } }, data: { departmentId: canonical.id } })).count);
  record(`Department ${codes.join('/')} merged into ${code} and removed`,
    (await tx.department.deleteMany({ where: { id: { in: ids } } })).count);
}

async function migrateRole(tx, { code, name, legacy }) {
  const legacyRoles = await tx.role.findMany({ where: { code: { in: legacy } } });
  legacyRoles.sort((a, b) => legacy.indexOf(a.code) - legacy.indexOf(b.code));

  let canonical = await tx.role.findUnique({ where: { code } });
  let mergeRoles = legacyRoles;
  if (!canonical && legacyRoles.length > 0) {
    canonical = await tx.role.update({ where: { id: legacyRoles[0].id }, data: { code, name } });
    record(`Role ${legacyRoles[0].code} renamed to ${code}`, 1);
    mergeRoles = legacyRoles.slice(1);
  }

  for (const role of mergeRoles) {
    const assignments = await tx.userRole.findMany({ where: { roleId: role.id } });
    for (const assignment of assignments) {
      const existing = await tx.userRole.findFirst({ where: { userId: assignment.userId, roleId: canonical.id } });
      if (existing) await tx.userRole.delete({ where: { id: assignment.id } });
      else await tx.userRole.update({ where: { id: assignment.id }, data: { roleId: canonical.id } });
    }
    const grants = await tx.rolePermission.findMany({ where: { roleId: role.id } });
    for (const grant of grants) {
      const existing = await tx.rolePermission.findFirst({ where: { roleId: canonical.id, permissionId: grant.permissionId } });
      if (existing) await tx.rolePermission.delete({ where: { id: grant.id } });
      else await tx.rolePermission.update({ where: { id: grant.id }, data: { roleId: canonical.id } });
    }
    await tx.role.delete({ where: { id: role.id } });
    record(`Role ${role.code} merged into ${code} (${assignments.length} user assignments)`, 1);
  }
}

/** InventoryStock is unique on (departmentCode, identifier); legacy rows that collide are folded into the surviving row. */
async function migrateInventoryStock(tx, code, legacy) {
  const rows = await tx.inventoryStock.findMany({ where: { departmentCode: { in: legacy } } });
  for (const row of rows) {
    const existing = await tx.inventoryStock.findUnique({
      where: { departmentCode_identifier: { departmentCode: code, identifier: row.identifier } },
    });
    if (existing) {
      await tx.inventoryStock.update({
        where: { id: existing.id },
        data: { currentQuantity: existing.currentQuantity + row.currentQuantity },
      });
      await tx.inventoryStock.delete({ where: { id: row.id } });
    } else {
      await tx.inventoryStock.update({ where: { id: row.id }, data: { departmentCode: code } });
    }
  }
  record(`InventoryStock.departmentCode -> ${code}`, rows.length);
}

async function migrate(tx) {
  const renameInPlace = await challanForeignKeysCascade(tx);
  if (!renameInPlace) {
    console.log('Note: Challan department foreign keys do not cascade on update; legacy departments will be merged into new rows.');
  }

  for (const target of DEPARTMENTS) {
    await migrateDepartment(tx, target, renameInPlace);
    for (const [model, column] of DEPARTMENT_CODE_COLUMNS) {
      const { count } = await tx[model].updateMany({
        where: { [column]: { in: target.legacy } },
        data: { [column]: target.code },
      });
      record(`${model}.${column} -> ${target.code}`, count);
    }
    await migrateInventoryStock(tx, target.code, target.legacy);
  }

  for (const target of ROLES) {
    await migrateRole(tx, target);
  }

  for (const [oldShelf, newShelf] of Object.entries(SHELF_CODES)) {
    record(`DefectRecord.shelfCode ${oldShelf} -> ${newShelf}`,
      (await tx.defectRecord.updateMany({ where: { shelfCode: oldShelf }, data: { shelfCode: newShelf } })).count);

    // Stored either as the bare code or as "CODE (Shelf Name)".
    const challans = await tx.challan.findMany({
      where: { defectiveShelfLocation: { startsWith: oldShelf } },
      select: { id: true, defectiveShelfLocation: true },
    });
    let updated = 0;
    for (const challan of challans) {
      const rest = challan.defectiveShelfLocation.slice(oldShelf.length);
      if (rest !== '' && !rest.startsWith(' ')) continue;
      await tx.challan.update({ where: { id: challan.id }, data: { defectiveShelfLocation: newShelf + rest } });
      updated++;
    }
    record(`Challan.defectiveShelfLocation ${oldShelf} -> ${newShelf}`, updated);
  }

  for (const [oldStatus, newStatus] of Object.entries(DYEING_ORDER_STATUSES)) {
    record(`DyeingOrder.status ${oldStatus} -> ${newStatus}`,
      (await tx.dyeingOrder.updateMany({ where: { status: oldStatus }, data: { status: newStatus } })).count);
  }

  if (DRY_RUN) throw new DryRunRollback();
}

async function main() {
  console.log(`--- QC department rename migration${DRY_RUN ? ' (dry run, nothing will be saved)' : ''} ---`);
  try {
    await prisma.$transaction(migrate, { maxWait: 15000, timeout: 300000 });
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }
  console.log(report.length ? report.join('\n') : '  Nothing to migrate: all QC codes are already current.');
  console.log(DRY_RUN ? '--- Dry run complete; transaction rolled back ---' : '--- Migration committed ---');
}

main()
  .catch((err) => {
    console.error('QC department migration failed; no changes were saved:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
