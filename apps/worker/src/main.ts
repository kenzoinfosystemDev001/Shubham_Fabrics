import { prisma } from '@subham/database';

async function runWorker() {
  console.log('--- Subham Fabrics MES Background Worker Initialized ---');
  console.log(`[Worker] Connected to database: ${new Date().toISOString()}`);

  // Periodic Reconciliation Loop (Simulated queue processor)
  setInterval(async () => {
    try {
      const openChallans = await prisma.challan.count({
        where: { status: { in: ['ISSUED', 'IN_PROCESS', 'REWORK'] } },
      });
      const activePrograms = await prisma.program.count({
        where: { status: 'IN_PRODUCTION' },
      });
      console.log(`[Worker Heartbeat] Active Programs: ${activePrograms} | WIP Challans on Shop Floor: ${openChallans}`);
    } catch (e) {
      console.error('[Worker Error]', e);
    }
  }, 60000);
}

runWorker().catch((err) => {
  console.error('[Worker Fatal Error]', err);
  process.exit(1);
});
