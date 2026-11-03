import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class AiGenerateDto {
  @ApiProperty({
    enum: ["caption", "hashtags", "cta", "rewrite", "ideas", "translate", "grammar"],
  })
  @IsEnum(["caption", "hashtags", "cta", "rewrite", "ideas", "translate", "grammar"])
  feature!: "caption" | "hashtags" | "cta" | "rewrite" | "ideas" | "translate" | "grammar";

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  prompt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audience?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandVoice?: string;
}
