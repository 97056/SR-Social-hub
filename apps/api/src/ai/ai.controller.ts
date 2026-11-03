import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CompanyAccessGuard } from "../common/guards/company-access.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AiService } from "./ai.service";
import { AiGenerateDto } from "./dto/ai.dto";

@ApiTags("ai")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
@Controller("companies/:companyId/ai")
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("generate")
  generate(
    @Param("companyId") companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AiGenerateDto,
  ) {
    return this.ai.generate(companyId, user, dto);
  }
}
