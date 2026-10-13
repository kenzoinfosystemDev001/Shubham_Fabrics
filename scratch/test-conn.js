const { PrismaClient } = require('./packages/database/dist');
const dbUrl = "postgresql://neondb_owner:npg_3h1GKCDxtAeX@ep-jolly-tree-b5ebsnbj-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});

async function main() {
  console.log('Connecting to Neon without channel_binding...');
  const count = await prisma.program.count();
  console.log('Programs count:', count);
  await prisma.$disconnect();
}

main().catch(console.error);
