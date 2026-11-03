import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "agency@srsocialhub.local" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "ChangeMeAgency!123" })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class AdminLoginDto {
  @ApiProperty({ example: "admin@srsocialhub.local" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "ChangeMeAdmin!123" })
  @IsString()
  @MinLength(8)
  password!: string;
}
