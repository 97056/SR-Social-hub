import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateClientDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandVoice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    enum: [
      "CLIENT_THEN_PUBLISH",
      "COMPANY_THEN_PUBLISH",
      "CLIENT_THEN_COMPANY",
      "CLIENT_THEN_AUTO_SCHEDULE",
    ],
  })
  @IsOptional()
  @IsEnum([
    "CLIENT_THEN_PUBLISH",
    "COMPANY_THEN_PUBLISH",
    "CLIENT_THEN_COMPANY",
    "CLIENT_THEN_AUTO_SCHEDULE",
  ])
  approvalWorkflow?:
    | "CLIENT_THEN_PUBLISH"
    | "COMPANY_THEN_PUBLISH"
    | "CLIENT_THEN_COMPANY"
    | "CLIENT_THEN_AUTO_SCHEDULE";
}
