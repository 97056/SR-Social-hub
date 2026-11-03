import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/jwt.strategy";
import { EntitlementsService } from "../billing/entitlements.service";
import { PrismaService } from "../prisma/prisma.service";
import { MockAiProvider, type AiProvider } from "./ai.provider";
import type { AiGenerateDto } from "./dto/ai.dto";

@Injectable()
export class AiService {
  private readonly provider: AiProvider = new MockAiProvider();

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async generate(companyId: string, user: AuthUser, dto: AiGenerateDto) {
    await this.assertCompanyAccess(companyId, user);
    const e = await this.entitlements.getEntitlements(companyId);
    if (e.quotas.ai.remaining <= 0) {
      throw new ForbiddenException("AI quota exceeded for current plan this month");
    }

    let brandVoice = dto.brandVoice;
    let industry = dto.industry;
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, companyId },
      });
      if (client) {
        brandVoice = brandVoice || client.brandVoice || undefined;
        industry = industry || client.industry || undefined;
      }
    }

    const result = await this.provider.generate({
      feature: dto.feature,
      prompt: dto.prompt,
      tone: dto.tone,
      language: dto.language,
      platform: dto.platform,
      industry,
      audience: dto.audience,
      brandVoice,
    });

    await this.prisma.aiUsageRecord.create({
      data: {
        companyId,
        userId: user.id,
        feature: dto.feature,
        provider: result.provider,
        units: 1,
        metadata: {
          platform: dto.platform,
          tone: dto.tone,
          language: dto.language,
        },
      },
    });

    const usage = await this.entitlements.getEntitlements(companyId);

    return {
      ...result,
      editable: true,
      usage: usage.quotas.ai,
    };
  }

  private async assertCompanyAccess(companyId: string, user: AuthUser) {
    if (user.globalRole === "SUPER_ADMIN") return;
    const membership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
    });
    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenException("No company access");
    }
  }
}
