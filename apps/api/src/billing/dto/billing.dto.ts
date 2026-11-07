import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, Max, Min } from "class-validator";

export class CheckoutDto {
  @ApiProperty({ example: "GROWTH" })
  @IsString()
  planCode!: string;

  @ApiPropertyOptional({ enum: ["MONTHLY", "YEARLY"] })
  @IsOptional()
  @IsEnum(["MONTHLY", "YEARLY"])
  interval?: "MONTHLY" | "YEARLY";
}

export class ChangePlanDto {
  @ApiProperty()
  @IsString()
  planCode!: string;

  @ApiPropertyOptional({ enum: ["MONTHLY", "YEARLY"] })
  @IsOptional()
  @IsEnum(["MONTHLY", "YEARLY"])
  interval?: "MONTHLY" | "YEARLY";
}

export class CancelSubscriptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  immediate?: boolean;
}

export class PurchaseAddonDto {
  @ApiProperty({ example: "EXTRA_CLIENT" })
  @IsString()
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  quantity?: number;
}

export class BillingWebhookDto {
  @ApiProperty()
  @IsString()
  provider!: string;

  @ApiProperty()
  @IsString()
  eventType!: string;

  @ApiProperty()
  @IsString()
  idempotencyKey!: string;

  @ApiProperty()
  @IsObject()
  payload!: Record<string, unknown>;
}

export class ConfirmRazorpayDto {
  @ApiProperty()
  @IsString()
  planCode!: string;

  @ApiPropertyOptional({ enum: ["MONTHLY", "YEARLY"] })
  @IsOptional()
  @IsEnum(["MONTHLY", "YEARLY"])
  interval?: "MONTHLY" | "YEARLY";

  @ApiProperty()
  @IsString()
  invoiceId!: string;

  @ApiProperty()
  @IsString()
  razorpayOrderId!: string;

  @ApiProperty()
  @IsString()
  razorpayPaymentId!: string;

  @ApiProperty()
  @IsString()
  razorpaySignature!: string;
}

export class UpdatePaymentSettingsDto {
  @ApiPropertyOptional({ enum: ["test", "live"] })
  @IsOptional()
  @IsEnum(["test", "live"])
  mode?: "test" | "live";

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  selfServeEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  testKeyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  testKeySecret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  liveKeyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  liveKeySecret?: string;
}
