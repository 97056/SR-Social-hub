import { PrismaClient } from "@prisma/client";
import { allocateUserCode } from "../src/common/user-code.util";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ where: { userCode: null } });
  for (const u of users) {
    const userCode = await allocateUserCode(prisma);
    await prisma.user.update({ where: { id: u.id }, data: { userCode } });
    console.log(`${u.email} -> ${userCode}`);
  }
  console.log(`Backfilled ${users.length} user(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
