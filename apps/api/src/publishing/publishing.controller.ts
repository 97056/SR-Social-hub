import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CompanyAccessGuard } from "../common/guards/company-access.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PublishingService } from "./publishing.service";

@ApiTags("publishing")
@ApiBearerAuth()
@Controller()
export class PublishingController {
  constructor(private readonly publishing: PublishingService) {}

  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Get("companies/:companyId/publishing/jobs")
  list(@Param("companyId") companyId: string, @CurrentUser() user: AuthUser) {
    return this.publishing.listJobs(companyId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("posts/:postId/publish")
  publishNow(@Param("postId") postId: string, @CurrentUser() user: AuthUser) {
    return this.publishing.enqueuePost(postId, user, { immediate: true });
  }

  @UseGuards(JwtAuthGuard)
  @Post("posts/:postId/enqueue")
  enqueue(@Param("postId") postId: string, @CurrentUser() user: AuthUser) {
    return this.publishing.enqueuePost(postId, user, { immediate: false });
  }

  @UseGuards(JwtAuthGuard)
  @Post("publishing/jobs/:jobId/retry")
  retry(@Param("jobId") jobId: string, @CurrentUser() user: AuthUser) {
    return this.publishing.retryJob(jobId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("publishing/jobs/:jobId/cancel")
  cancel(@Param("jobId") jobId: string, @CurrentUser() user: AuthUser) {
    return this.publishing.cancelJob(jobId, user);
  }

  /** Manual worker kick for local/testing. */
  @UseGuards(JwtAuthGuard)
  @Post("publishing/worker/tick")
  tick(@CurrentUser() _user: AuthUser) {
    return this.publishing.processDueJobs(20);
  }
}
