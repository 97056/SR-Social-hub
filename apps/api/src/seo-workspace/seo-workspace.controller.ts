import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsString } from "class-validator";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CompanyAccessGuard } from "../common/guards/company-access.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { SeoWorkspaceService } from "./seo-workspace.service";

class SeoClientDto {
  @IsString()
  clientId!: string;
}

@ApiTags("seo-workspace")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
@Controller("companies/:companyId/seo-workspace")
export class SeoWorkspaceController {
  constructor(private readonly seo: SeoWorkspaceService) {}

  @Get("clients")
  clients(@Param("companyId") companyId: string) {
    return this.seo.listClientSites(companyId);
  }

  @Post("analyze")
  analyze(
    @Param("companyId") companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SeoClientDto,
  ) {
    return this.seo.analyze(companyId, user, dto.clientId);
  }

  @Post("sitemap")
  sitemap(
    @Param("companyId") companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SeoClientDto,
  ) {
    return this.seo.generateSitemap(companyId, user, dto.clientId);
  }

  @Post("robots")
  robots(
    @Param("companyId") companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SeoClientDto,
  ) {
    return this.seo.generateRobots(companyId, user, dto.clientId);
  }
}
