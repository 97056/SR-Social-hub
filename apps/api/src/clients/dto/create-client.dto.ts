import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateClientDto {
  @ApiProperty({ description: "Contact person full name" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName!: string;

  @ApiProperty({ description: "Client organization / brand name" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  organizationName!: string;

  @ApiProperty({ description: "Login + contact email for the client user" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "9876543210", description: "10-digit Indian mobile" })
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: "Mobile must be a 10-digit Indian number starting with 6-9",
  })
  mobile!: string;

  @ApiPropertyOptional({ description: "Short description of the client organization" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: "Organization website URL" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;

  @ApiPropertyOptional({
    description: "Business / trade name — required when website is not provided",
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  businessName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  externalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandVoice?: string;

  @ApiPropertyOptional({
    description: "Client brand logo as a public URL or data URL (recommended 512×512)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_500_000)
  logoUrl?: string;

  /** @deprecated Prefer organizationName — kept for older callers */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  /** @deprecated Prefer email */
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;
}
