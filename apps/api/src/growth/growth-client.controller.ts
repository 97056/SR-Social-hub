import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ClientAccessGuard } from "../common/guards/client-access.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateGrowthReportDto,
  CreateGrowthTaskDto,
  RunGrowthAnalysisDto,
  UpdateGrowthPlanDto,
  UpdateGrowthTaskDto,
  UpdateOpportunityDto,
  UpsertGrowthProfileDto,
} from "./dto/growth.dto";
import { GrowthEnabledGuard } from "./growth-enabled.guard";
import { GrowthService } from "./growth.service";

@ApiTags("growth-client")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ClientAccessGuard, GrowthEnabledGuard)
@Controller("clients/:clientId/growth")
export class GrowthClientController {
  constructor(
    private readonly growth: GrowthService,
    private readonly prisma: PrismaService,
  ) {}

  private async companyId(clientId: string) {
    const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    return client.companyId;
  }

  @Get("overview")
  async overview(@Param("clientId") clientId: string) {
    const companyId = await this.companyId(clientId);
    return this.growth.overview(companyId, clientId);
  }

  @Get("profile")
  async profile(@Param("clientId") clientId: string) {
    const companyId = await this.companyId(clientId);
    return this.growth.getProfile(companyId, clientId);
  }

  @Patch("profile")
  async upsertProfile(
    @Param("clientId") clientId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertGrowthProfileDto,
  ) {
    const companyId = await this.companyId(clientId);
    return this.growth.upsertProfile(companyId, clientId, user, dto);
  }

  @Post("business-analysis")
  async business(@Param("clientId") clientId: string, @CurrentUser() user: AuthUser) {
    const companyId = await this.companyId(clientId);
    return this.growth.runBusinessAnalysis(companyId, user, { clientId });
  }

  @Post("website-audit")
  async website(
    @Param("clientId") clientId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: Partial<RunGrowthAnalysisDto>,
  ) {
    const companyId = await this.companyId(clientId);
    return this.growth.runWebsiteAudit(companyId, user, { clientId, websiteUrl: dto.websiteUrl });
  }

  @Get("opportunities")
  async opportunities(@Param("clientId") clientId: string, @Query("status") status?: string) {
    const companyId = await this.companyId(clientId);
    return this.growth.listOpportunities(companyId, clientId, status);
  }

  @Patch("opportunities/:opportunityId")
  async updateOpportunity(
    @Param("clientId") clientId: string,
    @Param("opportunityId") opportunityId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateOpportunityDto,
  ) {
    const companyId = await this.companyId(clientId);
    return this.growth.updateOpportunity(companyId, opportunityId, user, dto);
  }

  @Get("plans")
  async plans(@Param("clientId") clientId: string) {
    const companyId = await this.companyId(clientId);
    return this.growth.listPlans(companyId, clientId);
  }

  @Patch("plans/:planId")
  async updatePlan(
    @Param("clientId") clientId: string,
    @Param("planId") planId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateGrowthPlanDto,
  ) {
    const companyId = await this.companyId(clientId);
    return this.growth.updatePlan(companyId, planId, user, dto);
  }

  @Get("tasks")
  async tasks(@Param("clientId") clientId: string) {
    const companyId = await this.companyId(clientId);
    return this.growth.listTasks(companyId, clientId);
  }

  @Post("tasks")
  async createTask(
    @Param("clientId") clientId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: Omit<CreateGrowthTaskDto, "clientId">,
  ) {
    const companyId = await this.companyId(clientId);
    return this.growth.createTask(companyId, user, { ...dto, clientId });
  }

  @Patch("tasks/:taskId")
  async updateTask(
    @Param("clientId") clientId: string,
    @Param("taskId") taskId: string,
    @Body() dto: UpdateGrowthTaskDto,
  ) {
    const companyId = await this.companyId(clientId);
    return this.growth.updateTask(companyId, taskId, dto);
  }

  @Get("results")
  async results(@Param("clientId") clientId: string) {
    const companyId = await this.companyId(clientId);
    return this.growth.resultsTracker(companyId, clientId);
  }

  @Get("reports")
  async reports(@Param("clientId") clientId: string) {
    const companyId = await this.companyId(clientId);
    return this.growth.listReports(companyId, clientId);
  }

  @Post("reports")
  async createReport(
    @Param("clientId") clientId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: Omit<CreateGrowthReportDto, "clientId">,
  ) {
    const companyId = await this.companyId(clientId);
    return this.growth.createReport(companyId, user, { ...dto, clientId });
  }
}
