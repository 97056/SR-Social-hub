import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from "class-validator";

const emptyToUndef = ({ value }: { value: unknown }) =>
  value === "" || value === null || value === undefined ? undefined : value;

export class RegisterDto {
  @ApiProperty({ enum: ["INDIVIDUAL", "COMPANY"] })
  @IsIn(["INDIVIDUAL", "COMPANY"])
  accountKind!: "INDIVIDUAL" | "COMPANY";

  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndef)
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndef)
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndef)
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndef)
  @IsString()
  @Matches(/^[0-9A-Z]{15}$/i, { message: "GST number must be 15 characters" })
  gstNumber?: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;
}

export class ActivateAccountDto {
  @ApiProperty()
  @IsString()
  token!: string;
}
