import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { SupportChatService } from "./support-chat.service";

class SupportAskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}

class SupportLeadDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  company?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  message!: string;
}

@ApiTags("support-chat")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("support-chat")
export class SupportChatController {
  constructor(private readonly chat: SupportChatService) {}

  @Post("ask")
  ask(@CurrentUser() user: AuthUser, @Body() dto: SupportAskDto) {
    return this.chat.ask(dto.message, { fullName: user.fullName, email: user.email });
  }

  @Post("contact")
  contact(@CurrentUser() user: AuthUser, @Body() dto: SupportLeadDto) {
    const message = `[In-app chat · ${user.email}]\n${dto.message.trim()}`;
    return this.chat.submitLead({
      name: (dto.name || user.fullName || "Workspace user").trim(),
      email: (dto.email || user.email).trim().toLowerCase(),
      phone: dto.phone,
      company: dto.company,
      message,
    });
  }
}
