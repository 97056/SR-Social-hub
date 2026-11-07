import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CompetitorAnalysisDto {
  @ApiProperty({
    description: "Business description used to map category and competitors",
  })
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  businessDescription!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  websiteUrl?: string;
}
