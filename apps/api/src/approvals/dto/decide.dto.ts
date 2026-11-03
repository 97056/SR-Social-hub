import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class DecideApprovalDto {
  @ApiProperty({ enum: ["APPROVED", "REJECTED", "CHANGES_REQUESTED"] })
  @IsEnum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"])
  decision!: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string;
}
