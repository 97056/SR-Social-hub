import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";

export type JwtPayload = {
  sub: string;
  email: string;
  globalRole: string;
};

export type AuthUser = {
  id: string;
  userCode?: string | null;
  email: string;
  fullName: string;
  globalRole: "SUPER_ADMIN" | "USER";
  phone?: string | null;
  accountKind?: string | null;
  emailVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Session is no longer valid");
    }
    return {
      id: user.id,
      userCode: user.userCode,
      email: user.email,
      fullName: user.fullName,
      globalRole: user.globalRole,
      phone: user.phone,
      accountKind: user.accountKind,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
