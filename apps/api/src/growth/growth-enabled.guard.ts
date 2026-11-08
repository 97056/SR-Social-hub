import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { GrowthService } from "./growth.service";

/** Blocks company/client Growth APIs when Super Admin has disabled AI Growth Center. */
@Injectable()
export class GrowthEnabledGuard implements CanActivate {
  constructor(private readonly growth: GrowthService) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    if (!(await this.growth.isGrowthCenterEnabled())) {
      throw new ForbiddenException("AI Growth Center is disabled by admin");
    }
    return true;
  }
}
