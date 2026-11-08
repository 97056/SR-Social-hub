import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CompanyAccessGuard } from "../common/guards/company-access.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CampaignPlanDto,
  CreateGrowthPlanDto,
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

@ApiTags("growth")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyAccessGuard, GrowthEnabledGuard)
@Controller("companies/:companyId/growth")
export class GrowthController {
  constructor(private readonly growth: GrowthService) {}

  @Get("overview")
  overview(@Param("companyId") companyId: string, @Query("clientId") clientId?: string) {
    return this.growth.overview(companyId, clientId);
  }

  @Get("usage")
  usage(@Param("companyId") companyId: string) {
    return this.growth.usage(companyId);
  }

  @Get("jobs")
  jobs(@Param("companyId") companyId: string) {
    return this.growth.listJobs(companyId);
  }

  @Get("runs")
  runs(@Param("companyId") companyId: string, @Query("clientId") clientId?: string) {
    return this.growth.listRuns(companyId, clientId);
  }

  @Get("profile/:clientId")
  profile(@Param("companyId") companyId: string, @Param("clientId") clientId: string) {
    return this.growth.getProfile(companyId, clientId);
  }

  @Patch("profile/:clientId")
  upsertProfile(
    @Param("companyId") companyId: string,
    @Param("clientId") clientId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertGrowthProfileDto,
  ) {
    return this.growth.upsertProfile(companyId, clientId, user, dto);
  }

  @Post("business-analysis")
  business(@Param("companyId") companyId: string, @CurrentUser() user: AuthUser, @Body() dto: RunGrowthAnalysisDto) {
    return this.growth.runBusinessAnalysis(companyId, user, dto);
  }

  @Post("website-audit")
  website(@Param("companyId") companyId: string, @CurrentUser() user: AuthUser, @Body() dto: RunGrowthAnalysisDto) {
    return this.growth.runWebsiteAudit(companyId, user, dto);
  }

  @Post("social-audit")
  social(@Param("companyId") companyId: string, @CurrentUser() user: AuthUser, @Body() dto: RunGrowthAnalysisDto) {
    return this.growth.runSocialAudit(companyId, user, dto);
  }

  @Post("seo-analysis")
  seo(@Param("companyId") companyId: string, @CurrentUser() user: AuthUser, @Body() dto: RunGrowthAnalysisDto) {
    return this.growth.runSeoAnalysis(companyId, user, dto);
  }

  @Post("competitor-analysis")
  competitors(
    @Param("companyId") companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RunGrowthAnalysisDto,
  ) {
    return this.growth.runCompetitorAnalysis(companyId, user, dto);
  }

  @Post("campaigns")
  campaign(@Param("companyId") companyId: string, @CurrentUser() user: AuthUser, @Body() dto: CampaignPlanDto) {
    return this.growth.createCampaign(companyId, user, dto);
  }

  @Post("opportunities/discover")
  discover(@Param("companyId") companyId: string, @CurrentUser() user: AuthUser, @Body() dto: RunGrowthAnalysisDto) {
    return this.growth.discoverOpportunities(companyId, user, dto);
  }

  @Get("opportunities")
  opportunities(
    @Param("companyId") companyId: string,
    @Query("clientId") clientId?: string,
    @Query("status") status?: string,
  ) {
    return this.growth.listOpportunities(companyId, clientId, status);
  }

  @Patch("opportunities/:opportunityId")
  updateOpportunity(
    @Param("companyId") companyId: string,
    @Param("opportunityId") opportunityId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.growth.updateOpportunity(companyId, opportunityId, user, dto);
  }

  @Get("plans")
  plans(@Param("companyId") companyId: string, @Query("clientId") clientId?: string) {
    return this.growth.listPlans(companyId, clientId);
  }

  @Post("plans")
  createPlan(@Param("companyId") companyId: string, @CurrentUser() user: AuthUser, @Body() dto: CreateGrowthPlanDto) {
    return this.growth.createPlan(companyId, user, dto);
  }

  @Patch("plans/:planId")
  updatePlan(
    @Param("companyId") companyId: string,
    @Param("planId") planId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateGrowthPlanDto,
  ) {
    return this.growth.updatePlan(companyId, planId, user, dto);
  }

  @Get("tasks")
  tasks(@Param("companyId") companyId: string, @Query("clientId") clientId?: string) {
    return this.growth.listTasks(companyId, clientId);
  }

  @Post("tasks")
  createTask(@Param("companyId") companyId: string, @CurrentUser() user: AuthUser, @Body() dto: CreateGrowthTaskDto) {
    return this.growth.createTask(companyId, user, dto);
  }

  @Patch("tasks/:taskId")
  updateTask(
    @Param("companyId") companyId: string,
    @Param("taskId") taskId: string,
    @Body() dto: UpdateGrowthTaskDto,
  ) {
    return this.growth.updateTask(companyId, taskId, dto);
  }

  @Get("results/:clientId")
  results(@Param("companyId") companyId: string, @Param("clientId") clientId: string) {
    return this.growth.resultsTracker(companyId, clientId);
  }

  @Post("results/:clientId/snapshots")
  snapshot(
    @Param("companyId") companyId: string,
    @Param("clientId") clientId: string,
    @Body() body: { label: string; metrics: Record<string, unknown>; note?: string },
  ) {
    return this.growth.addSnapshot(companyId, clientId, body);
  }

  @Get("reports")
  reports(@Param("companyId") companyId: string, @Query("clientId") clientId?: string) {
    return this.growth.listReports(companyId, clientId);
  }

  @Post("reports")
  createReport(
    @Param("companyId") companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateGrowthReportDto,
  ) {
    return this.growth.createReport(companyId, user, dto);
  }
}
