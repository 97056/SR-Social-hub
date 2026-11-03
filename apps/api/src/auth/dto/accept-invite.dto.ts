import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class AcceptInviteDto {
  @ApiProperty()
  @IsString()
  @MinLength(16)
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;
}
