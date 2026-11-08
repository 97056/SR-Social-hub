import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class UpsertGrowthProfileDto {
  @IsOptional() @IsString() @MaxLength(200) businessName?: string;
  @IsOptional() @IsString() @MaxLength(500) websiteUrl?: string;
  @IsOptional() @IsString() @MaxLength(120) industry?: string;
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsString() @MaxLength(4000) productsServices?: string;
  @IsOptional() @IsString() @MaxLength(2000) targetAudience?: string;
  @IsOptional() @IsString() @MaxLength(500) location?: string;
  @IsOptional() @IsString() @MaxLength(1000) serviceAreas?: string;
  @IsOptional() @IsString() @MaxLength(2000) goals?: string;
  @IsOptional() @IsString() @MaxLength(2000) competitors?: string;
  @IsOptional() @IsString() @MaxLength(2000) uniqueSellingPoints?: string;
  @IsOptional() @IsString() @MaxLength(2000) challenges?: string;
  @IsOptional() @IsString() @MaxLength(120) monthlyBudgetRange?: string;
  @IsOptional() confirm?: boolean;
}

export class RunGrowthAnalysisDto {
  @IsString() clientId!: string;
  @IsOptional() @IsString() @MaxLength(500) websiteUrl?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}

export class CampaignPlanDto {
  @IsString() clientId!: string;
  @IsString() @MinLength(3) @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(500) objective?: string;
  @IsOptional() @IsString() @MaxLength(1000) targetAudience?: string;
  @IsOptional() @IsString() @MaxLength(500) productService?: string;
  @IsOptional() @IsInt() @Min(7) @Max(180) durationDays?: number;
  @IsOptional() @IsString() @MaxLength(120) budgetRange?: string;
  @IsOptional() networks?: string[];
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsString() @MaxLength(500) offer?: string;
}

export class UpdateOpportunityDto {
  @IsIn([
    "NEW",
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
    "CONVERTED_TO_TASK",
    "IN_PROGRESS",
    "COMPLETED",
  ])
  status!: string;

  @IsOptional() @IsString() @MaxLength(2000) feedbackNote?: string;
}

export class CreateGrowthPlanDto {
  @IsString() clientId!: string;
  @IsOptional() @IsInt() @Min(30) @Max(90) horizonDays?: number;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
}

export class UpdateGrowthPlanDto {
  @IsOptional()
  @IsIn(["DRAFT", "PENDING_APPROVAL", "APPROVED", "ACTIVE", "COMPLETED", "ARCHIVED"])
  status?: string;

  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsObject() objectives?: object;
  @IsOptional() @IsObject() strategies?: object;
  @IsOptional() @IsString() summary?: string;
}

export class CreateGrowthTaskDto {
  @IsString() clientId!: string;
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() assigneeName?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() opportunityId?: string;
  @IsOptional() @IsString() planId?: string;
}

export class UpdateGrowthTaskDto {
  @IsOptional() @IsIn(["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]) status?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() assigneeName?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() completionNote?: string;
  @IsOptional() @IsString() contentDraft?: string;
}

export class CreateGrowthReportDto {
  @IsString() clientId!: string;
  @IsIn([
    "BUSINESS_ANALYSIS",
    "WEBSITE_AUDIT",
    "SOCIAL_AUDIT",
    "COMPETITOR_ANALYSIS",
    "SEO",
    "MARKETING_STRATEGY",
    "GROWTH_PLAN",
    "MONTHLY_GROWTH",
  ])
  kind!: string;

  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(120) periodLabel?: string;
}

export class UpdateGrowthAiSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() provider?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10_000) dailyLimit?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100_000) monthlyLimit?: number;
  @IsOptional() @IsInt() @Min(100) @Max(32_000) maxTokens?: number;
  @IsOptional() @IsString() alertEmail?: string;
}
