const { PrismaClient } = require('@subham/database');

const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log('--- Cleaning DB: Removing all test/dummy data, production sheets, challans, and transactions ---');

  try {
    // 1. Transactional logs, defects, rework & inspections
    console.log('Clearing quality inspections, rework, and defect records...');
    await prisma.qualityInspectionParameter.deleteMany({});
    await prisma.defectLog.deleteMany({});
    await prisma.defectRecord.deleteMany({});
    await prisma.reworkTransaction.deleteMany({});
    await prisma.recutRequest.deleteMany({});
    await prisma.fabricQCInspection.deleteMany({});
    await prisma.qualityInspection.deleteMany({});

    // 2. Production Transactions (these reference challans and programs)
    console.log('Clearing production transactions...');
    await prisma.productionTransaction.deleteMany({});

    // 3. Dispatch, Cartons, Bundles, and Rolls (these reference challans)
    console.log('Clearing dispatch orders, cartons, and bundles...');
    await prisma.dispatchCarton.deleteMany({});
    await prisma.dispatchOrder.deleteMany({});
    await prisma.cartonBundle.deleteMany({});
    await prisma.carton.deleteMany({});
    await prisma.bundle.deleteMany({});
    await prisma.fabricRoll.deleteMany({});

    // 4. Dyeing Orders (these reference inbound and qc1 challans)
    console.log('Clearing dyeing orders...');
    await prisma.dyeingOrder.deleteMany({});

    // 5. Fabric store batches, receipts, rolls, and ledgers
    console.log('Clearing fabric store receipts, rolls, batches, and ledger entries...');
    await prisma.materialReceiptItem.deleteMany({});
    await prisma.materialReceipt.deleteMany({});
    await prisma.fabricStockLedger.deleteMany({});
    await prisma.fabricStoreRoll.deleteMany({});
    await prisma.fabricBatch.deleteMany({});

    // 6. Inventory stock & ledger
    console.log('Clearing inventory stocks & ledger entries...');
    await prisma.stockLedgerEntry.deleteMany({});
    await prisma.inventoryStock.deleteMany({});

    // 7. Challans, events, and items
    console.log('Clearing challan items, events, and challans...');
    await prisma.challanItem.deleteMany({});
    await prisma.challanEvent.deleteMany({});
    // Clear parentChallanId self-references first
    await prisma.challan.updateMany({
      where: { parentChallanId: { not: null } },
      data: { parentChallanId: null },
    });
    await prisma.challan.deleteMany({});

    // 8. Production Sheets (Programs) and sub-tables
    console.log('Clearing production sheets (programs) and specifications...');
    await prisma.programRouteStep.deleteMany({});
    await prisma.programRoute.deleteMany({});
    await prisma.programBOM.deleteMany({});
    await prisma.programSpecification.deleteMany({});
    await prisma.programFabric.deleteMany({});
    await prisma.programColour.deleteMany({});
    await prisma.programSize.deleteMany({});
    await prisma.attachment.deleteMany({});
    await prisma.program.deleteMany({});

    // 9. System notifications & audit logs
    console.log('Clearing notifications, audit logs, and integrity scan results...');
    await prisma.notification.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.integrityScanResult.deleteMany({});
    await prisma.idempotencyRecord.deleteMany({});

    console.log('========================================================');
    console.log(' SUCCESS: Database cleaned! All production sheets, challans,');
    console.log(' and test transaction records have been wiped clean.');
    console.log(' Core users, roles, and master departments are preserved.');
    console.log('========================================================');
  } catch (error) {
    console.error('Error while cleaning database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase();
