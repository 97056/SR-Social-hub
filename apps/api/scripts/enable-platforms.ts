import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.socialPlatform.updateMany({
    where: {
      code: {
        in: ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "X", "YOUTUBE", "PINTEREST", "THREADS"],
      },
    },
    data: { enabled: true },
  });
  const rows = await prisma.socialPlatform.findMany({
    select: { code: true, enabled: true },
    orderBy: { code: "asc" },
  });
  for (const r of rows) console.log(`${r.code}: ${r.enabled}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
