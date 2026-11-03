import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SocialPlatformCode } from "@prisma/client";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CompanyAccessGuard } from "../common/guards/company-access.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ComposerService } from "./composer.service";
import {
  CreateCampaignDto,
  CreatePostDto,
  SubmitPostDto,
  UpdatePostDto,
} from "./dto/composer.dto";

@ApiTags("composer")
@ApiBearerAuth()
@Controller()
export class ComposerController {
  constructor(private readonly composer: ComposerService) {}

  @UseGuards(JwtAuthGuard)
  @Get("composer/platform-rules")
  rules() {
    return this.composer.platformRules();
  }

  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Get("companies/:companyId/posts")
  list(
    @Param("companyId") companyId: string,
    @CurrentUser() user: AuthUser,
    @Query("clientId") clientId?: string,
  ) {
    return this.composer.listPosts(companyId, clientId, user);
  }

  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Post("companies/:companyId/posts")
  create(
    @Param("companyId") companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePostDto,
  ) {
    return this.composer.createPost(companyId, user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("posts/:postId")
  get(@Param("postId") postId: string, @CurrentUser() user: AuthUser) {
    return this.composer.getPost(postId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("posts/:postId")
  update(
    @Param("postId") postId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePostDto,
  ) {
    return this.composer.updatePost(postId, user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("posts/:postId/apply-base")
  applyBase(
    @Param("postId") postId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { platforms: SocialPlatformCode[] },
  ) {
    return this.composer.applyBaseToVariants(postId, user, body.platforms ?? []);
  }

  @UseGuards(JwtAuthGuard)
  @Get("posts/:postId/validate")
  validate(@Param("postId") postId: string, @CurrentUser() user: AuthUser) {
    return this.composer.getPost(postId, user).then(() => this.composer.validatePost(postId));
  }

  @UseGuards(JwtAuthGuard)
  @Post("posts/:postId/submit")
  submit(
    @Param("postId") postId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitPostDto,
  ) {
    return this.composer.submit(postId, user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("posts/:postId/duplicate")
  duplicate(@Param("postId") postId: string, @CurrentUser() user: AuthUser) {
    return this.composer.duplicate(postId, user);
  }

  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Get("companies/:companyId/clients/:clientId/campaigns")
  listCampaigns(
    @Param("companyId") companyId: string,
    @Param("clientId") clientId: string,
  ) {
    return this.composer.listCampaigns(companyId, clientId);
  }

  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Post("companies/:companyId/clients/:clientId/campaigns")
  createCampaign(
    @Param("companyId") companyId: string,
    @Param("clientId") clientId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.composer.createCampaign(companyId, clientId, user, dto);
  }
}
