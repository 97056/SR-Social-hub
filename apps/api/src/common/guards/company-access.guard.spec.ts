import { ForbiddenException } from "@nestjs/common";
import { CompanyAccessGuard } from "./company-access.guard";

describe("CompanyAccessGuard", () => {
  const prisma = {
    company: { findUnique: jest.fn() },
    companyMember: { findUnique: jest.fn() },
  };
  const guard = new CompanyAccessGuard(prisma as never);

  function ctx(user: unknown, companyId?: string) {
    const request = { user, params: { companyId }, companyMembership: undefined };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;
  }

  it("denies when membership missing", async () => {
    prisma.companyMember.findUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(ctx({ id: "u1", globalRole: "USER" }, "co1")),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows active company membership", async () => {
    prisma.companyMember.findUnique.mockResolvedValue({
      status: "ACTIVE",
      role: "OWNER",
      company: { status: "ACTIVE" },
    });
    await expect(
      guard.canActivate(ctx({ id: "u1", globalRole: "USER" }, "co1")),
    ).resolves.toBe(true);
  });
});
