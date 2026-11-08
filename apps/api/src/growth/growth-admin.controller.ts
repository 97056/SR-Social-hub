import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Roles, RolesGuard } from "../common/guards/roles.guard";
import { UpdateGrowthAiSettingsDto } from "./dto/growth.dto";
import { GrowthService } from "./growth.service";

@ApiTags("growth-admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPER_ADMIN")
@Controller("admin/growth")
export class GrowthAdminController {
  constructor(private readonly growth: GrowthService) {}

  @Get("overview")
  overview() {
    return this.growth.adminOverview();
  }

  @Get("settings")
  settings() {
    return this.growth.getAiSettings();
  }

  @Patch("settings")
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateGrowthAiSettingsDto) {
    return this.growth.updateAiSettings(user, dto);
  }
}
