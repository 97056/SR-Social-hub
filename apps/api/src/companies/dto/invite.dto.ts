import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsOptional, IsString } from "class-validator";

export class InviteCompanyMemberDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ["ADMIN", "MANAGER", "MEMBER", "APPROVER"] })
  @IsEnum(["ADMIN", "MANAGER", "MEMBER", "APPROVER"])
  role!: "ADMIN" | "MANAGER" | "MEMBER" | "APPROVER";
}

export class InviteClientUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: ["OWNER", "APPROVER", "VIEWER"] })
  @IsOptional()
  @IsEnum(["OWNER", "APPROVER", "VIEWER"])
  role?: "OWNER" | "APPROVER" | "VIEWER";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;
}
