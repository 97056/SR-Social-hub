import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";

export class CreateCompanyDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  planCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  ownerPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerName?: string;
}

export class UpdateCompanyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"] })
  @IsOptional()
  @IsEnum(["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"])
  status?: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  planCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdatePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyPriceInr?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  yearlyPriceInr?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  clientQuota?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  aiQuota?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  storageMb?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  accountQuota?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  teamQuota?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  entitlements?: Record<string, unknown>;
}

export class UpdateIntegrationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  oauthClientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientSecret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  redirectUri?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  capabilities?: Record<string, unknown>;
}

export class UpdateBrandingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platformName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  loginHeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  loginSubcopy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supportEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  themeDefault?: "dark" | "light";
}

export class UpdateSystemSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultTimezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  trialDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  inviteExpiryHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, boolean>;
}
