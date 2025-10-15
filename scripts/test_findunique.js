const { PrismaClient } = require('../lib/generated/prisma');

const prisma = new PrismaClient();

async function test() {
  for (let id = 1; id <= 100; id++) {
    try {
      const entry = await prisma.hochschuhl_abc.findUnique({ where: { id } });
      console.log(`ID ${id}: OK`);
    } catch (err) {
      console.log(`ID ${id}: ERROR - ${err.message}`);
      break;
    }
  }
  await prisma.$disconnect();
}

test();