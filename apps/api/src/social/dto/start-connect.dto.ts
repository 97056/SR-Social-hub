import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class StartConnectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  redirectTo?: string;
}
