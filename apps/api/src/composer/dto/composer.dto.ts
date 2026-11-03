import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SocialPlatformCode } from "@prisma/client";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CreatePostDto {
  @ApiProperty()
  @IsString()
  clientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaAssetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  baseCaption?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  baseHashtags?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  callToAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandVoice?: string;
}

export class VariantDto {
  @ApiProperty({ enum: SocialPlatformCode })
  @IsEnum(SocialPlatformCode)
  platformCode!: SocialPlatformCode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hashtags?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cta?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkUrl?: string;
}

export class TargetDto {
  @ApiProperty({ enum: SocialPlatformCode })
  @IsEnum(SocialPlatformCode)
  platformCode!: SocialPlatformCode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  socialAccountId?: string;
}

export class UpdatePostDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaAssetId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  baseCaption?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  baseHashtags?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  callToAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandVoice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;

  @ApiPropertyOptional({ type: [VariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants?: VariantDto[];

  @ApiPropertyOptional({ type: [TargetDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TargetDto)
  targets?: TargetDto[];
}

export class SubmitPostDto {
  @ApiPropertyOptional({ enum: ["DRAFT", "PENDING_APPROVAL", "SCHEDULED"] })
  @IsOptional()
  @IsEnum(["DRAFT", "PENDING_APPROVAL", "SCHEDULED"])
  action?: "DRAFT" | "PENDING_APPROVAL" | "SCHEDULED";

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objective?: string;
}
