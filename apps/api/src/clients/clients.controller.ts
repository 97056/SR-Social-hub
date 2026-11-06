import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ClientAccessGuard } from "../common/guards/client-access.guard";
import { CompanyAccessGuard } from "../common/guards/company-access.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { ClientsService } from "./clients.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

@ApiTags("clients")
@ApiBearerAuth()
@Controller()
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Post("companies/:companyId/clients")
  create(
    @Param("companyId") companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateClientDto,
  ) {
    return this.clients.createForCompany(companyId, user, dto);
  }

  @UseGuards(JwtAuthGuard, ClientAccessGuard)
  @Get("clients/:clientId/workspace")
  workspace(@Param("clientId") clientId: string) {
    return this.clients.getWorkspace(clientId);
  }

  @UseGuards(JwtAuthGuard, ClientAccessGuard)
  @Get("clients/:clientId/posts")
  posts(@Param("clientId") clientId: string) {
    return this.clients.listPosts(clientId);
  }

  @UseGuards(JwtAuthGuard, ClientAccessGuard)
  @Patch("clients/:clientId")
  update(
    @Param("clientId") clientId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clients.update(clientId, user, dto);
  }
}
