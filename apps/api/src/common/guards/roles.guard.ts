import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthUser } from "../../auth/jwt.strategy";

export const ROLES_KEY = "roles";
export const Roles = (...roles: Array<"SUPER_ADMIN" | "USER">) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Array<"SUPER_ADMIN" | "USER">>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const request = context.switchToHttp().getRequest<{ user: AuthUser }>();
    if (!request.user || !roles.includes(request.user.globalRole)) {
      throw new ForbiddenException("Insufficient role");
    }
    return true;
  }
}
