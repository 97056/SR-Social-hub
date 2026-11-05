import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: { create: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
    companyMember: { findMany: jest.fn() },
    clientMember: { findMany: jest.fn() },
  };

  const jwt = { signAsync: jest.fn().mockResolvedValue("token") } as unknown as JwtService;
  const config = { get: jest.fn(), getOrThrow: jest.fn() } as unknown as ConfigService;
  const mail = {
    sendMail: jest.fn(),
    shellHtml: jest.fn().mockReturnValue("<html/>"),
    clientAccessHtml: jest.fn().mockReturnValue("<html/>"),
  };
  const service = new AuthService(prisma as never, jwt, config, mail as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects invalid credentials", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login("x@y.com", "password1")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("blocks super admin from main login", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "1",
      email: "admin@test.com",
      isActive: true,
      emailVerifiedAt: new Date(),
      globalRole: "SUPER_ADMIN",
      passwordHash: await bcrypt.hash("password1", 4),
      companyMemberships: [],
      clientMemberships: [],
    });
    await expect(service.login("admin@test.com", "password1", false)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("returns company redirect for agency users", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "2",
      email: "agency@test.com",
      fullName: "Agency",
      isActive: true,
      emailVerifiedAt: new Date(),
      globalRole: "USER",
      passwordHash: await bcrypt.hash("password1", 4),
      companyMemberships: [
        {
          companyId: "c1",
          role: "OWNER",
          company: { name: "Demo", status: "TRIAL" },
        },
      ],
      clientMemberships: [],
    });
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});

    const result = await service.login("agency@test.com", "password1", false);
    expect(result.redirectTo).toBe("/app/c1/dashboard");
    expect(result.accessToken).toBe("token");
  });
});
