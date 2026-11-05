import { randomInt } from "crypto";

type UserCodeDb = {
  user: {
    findUnique: (args: {
      where: { userCode: string };
    }) => Promise<{ id: string } | null>;
  };
};

/** Public user id format: SRSH-######## (8 digits). Prefix SRSH is fixed. */
export function generateUserCode() {
  const digits = Array.from({ length: 8 }, () => String(randomInt(0, 10))).join("");
  return `SRSH-${digits}`;
}

export async function allocateUserCode(prisma: UserCodeDb) {
  for (let i = 0; i < 20; i++) {
    const userCode = generateUserCode();
    const exists = await prisma.user.findUnique({ where: { userCode } });
    if (!exists) return userCode;
  }
  throw new Error("Could not allocate a unique SRSH user code");
}
