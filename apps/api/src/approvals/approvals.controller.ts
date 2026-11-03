import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ClientAccessGuard } from "../common/guards/client-access.guard";
import { CompanyAccessGuard } from "../common/guards/company-access.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ApprovalsService } from "./approvals.service";
import { DecideApprovalDto } from "./dto/decide.dto";

@ApiTags("approvals")
@ApiBearerAuth()
@Controller()
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Get("companies/:companyId/approvals/inbox")
  companyInbox(@Param("companyId") companyId: string, @CurrentUser() user: AuthUser) {
    return this.approvals.companyInbox(companyId, user);
  }

  @UseGuards(JwtAuthGuard, ClientAccessGuard)
  @Get("clients/:clientId/approvals/inbox")
  clientInbox(@Param("clientId") clientId: string, @CurrentUser() user: AuthUser) {
    return this.approvals.clientInbox(clientId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get("posts/:postId/approvals")
  history(@Param("postId") postId: string, @CurrentUser() user: AuthUser) {
    return this.approvals.history(postId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("approvals/:approvalId/decide")
  decide(
    @Param("approvalId") approvalId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: DecideApprovalDto,
  ) {
    return this.approvals.decide(approvalId, user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("posts/:postId/approvals/resubmit")
  resubmit(@Param("postId") postId: string, @CurrentUser() user: AuthUser) {
    return this.approvals.startApprovalFlow(postId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("posts/:postId/approvals/verify")
  verify(@Param("postId") postId: string) {
    return this.approvals.verifyApprovalsValid(postId);
  }
}
