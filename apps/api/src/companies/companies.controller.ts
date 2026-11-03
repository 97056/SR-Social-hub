import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CompanyAccessGuard } from "../common/guards/company-access.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CompaniesService } from "./companies.service";
import { InviteClientUserDto, InviteCompanyMemberDto } from "./dto/invite.dto";

@ApiTags("companies")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
@Controller("companies/:companyId")
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get("workspace")
  workspace(@Param("companyId") companyId: string) {
    return this.companies.getWorkspace(companyId);
  }

  @Get("command-center")
  commandCenter(@Param("companyId") companyId: string) {
    return this.companies.commandCenter(companyId);
  }

  @Post("invitations")
  inviteMember(
    @Param("companyId") companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: InviteCompanyMemberDto,
  ) {
    return this.companies.inviteMember(companyId, user, dto);
  }

  @Post("clients/:clientId/invitations")
  inviteClient(
    @Param("companyId") companyId: string,
    @Param("clientId") clientId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: InviteClientUserDto,
  ) {
    return this.companies.inviteClientUser(companyId, clientId, user, dto);
  }
}
