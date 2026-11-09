import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SocialPlatformCode } from "@prisma/client";
import type { AuthUser } from "../auth/jwt.strategy";
import { ApprovalsService } from "../approvals/approvals.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateCampaignDto,
  CreatePostDto,
  SubmitPostDto,
  UpdatePostDto,
} from "./dto/composer.dto";
import { PLATFORM_RULES } from "./platform-rules";

@Injectable()
export class ComposerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
  ) {}

  async createCampaign(companyId: string, clientId: string, user: AuthUser, dto: CreateCampaignDto) {
    await this.assertCanManage(companyId, user);
    await this.assertClient(companyId, clientId);
    return this.prisma.campaign.create({
      data: {
        companyId,
        clientId,
        name: dto.name,
        objective: dto.objective,
      },
    });
  }

  listCampaigns(companyId: string, clientId: string) {
    return this.prisma.campaign.findMany({
      where: { companyId, clientId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createPost(companyId: string, user: AuthUser, dto: CreatePostDto) {
    await this.assertCanManage(companyId, user);
    await this.assertClient(companyId, dto.clientId);

    if (dto.mediaAssetId) {
      const media = await this.prisma.mediaAsset.findFirst({
        where: { id: dto.mediaAssetId, companyId, clientId: dto.clientId },
      });
      if (!media) throw new BadRequestException("Media does not belong to this client");
    }

    const post = await this.prisma.contentPost.create({
      data: {
        companyId,
        clientId: dto.clientId,
        campaignId: dto.campaignId,
        authorId: user.id,
        mediaAssetId: dto.mediaAssetId,
        baseCaption: dto.baseCaption ?? "",
        baseHashtags: dto.baseHashtags ?? "",
        callToAction: dto.callToAction,
        linkUrl: dto.linkUrl,
        brandVoice: dto.brandVoice,
        status: "DRAFT",
      },
      include: this.postInclude(),
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        companyId,
        action: "POST_DRAFT_CREATED",
        entityType: "ContentPost",
        entityId: post.id,
      },
    });

    return post;
  }

  async getPost(postId: string, user: AuthUser) {
    const post = await this.prisma.contentPost.findUnique({
      where: { id: postId },
      include: this.postInclude(),
    });
    if (!post) throw new NotFoundException("Post not found");
    await this.assertCanView(post.companyId, post.clientId, user);
    return post;
  }

  async listPosts(companyId: string, clientId: string | undefined, user: AuthUser) {
    await this.assertCanManage(companyId, user);
    return this.prisma.contentPost.findMany({
      where: { companyId, clientId: clientId || undefined },
      include: this.postInclude(),
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  async updatePost(postId: string, user: AuthUser, dto: UpdatePostDto) {
    const existing = await this.getPost(postId, user);
    await this.assertCanManage(existing.companyId, user);
    if (!["DRAFT", "REJECTED", "PENDING_APPROVAL", "APPROVED"].includes(existing.status)) {
      throw new BadRequestException("Only draft/pending/rejected/approved posts can be edited");
    }

    if (["PENDING_APPROVAL", "APPROVED"].includes(existing.status)) {
      await this.approvals.invalidateOnEdit(postId, user.id);
    }

    if (dto.mediaAssetId) {
      const media = await this.prisma.mediaAsset.findFirst({
        where: {
          id: dto.mediaAssetId,
          companyId: existing.companyId,
          clientId: existing.clientId,
        },
      });
      if (!media) throw new BadRequestException("Media does not belong to this client");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.contentPost.update({
        where: { id: postId },
        data: {
          mediaAssetId: dto.mediaAssetId === undefined ? undefined : dto.mediaAssetId,
          baseCaption: dto.baseCaption,
          baseHashtags: dto.baseHashtags,
          callToAction: dto.callToAction,
          linkUrl: dto.linkUrl,
          brandVoice: dto.brandVoice,
          scheduledAt: dto.scheduledAt === undefined ? undefined : dto.scheduledAt
            ? new Date(dto.scheduledAt)
            : null,
          revision: { increment: 1 },
          status: ["PENDING_APPROVAL", "APPROVED"].includes(existing.status)
            ? "DRAFT"
            : existing.status,
          currentApprovalStep: null,
        },
      });

      if (dto.variants) {
        for (const variant of dto.variants) {
          await tx.postVariant.upsert({
            where: {
              postId_platformCode: {
                postId,
                platformCode: variant.platformCode,
              },
            },
            create: {
              postId,
              platformCode: variant.platformCode,
              caption: variant.caption ?? "",
              title: variant.title,
              description: variant.description,
              hashtags: variant.hashtags ?? "",
              cta: variant.cta,
              linkUrl: variant.linkUrl,
            },
            update: {
              caption: variant.caption ?? "",
              title: variant.title,
              description: variant.description,
              hashtags: variant.hashtags ?? "",
              cta: variant.cta,
              linkUrl: variant.linkUrl,
            },
          });
        }
      }

      if (dto.targets) {
        await tx.postTarget.deleteMany({ where: { postId } });
        if (dto.targets.length) {
          await tx.postTarget.createMany({
            data: dto.targets.map((t) => ({
              postId,
              platformCode: t.platformCode,
              socialAccountId: t.socialAccountId,
              status: "PENDING",
            })),
          });
        }
      }
    });

    const validation = await this.validatePost(postId);
    await this.prisma.contentPost.update({
      where: { id: postId },
      data: { validationJson: validation as object },
    });

    return this.getPost(postId, user);
  }

  async applyBaseToVariants(postId: string, user: AuthUser, platforms: SocialPlatformCode[]) {
    const post = await this.getPost(postId, user);
    await this.assertCanManage(post.companyId, user);

    for (const platformCode of platforms) {
      await this.prisma.postVariant.upsert({
        where: { postId_platformCode: { postId, platformCode } },
        create: {
          postId,
          platformCode,
          caption: post.baseCaption,
          hashtags: post.baseHashtags,
          cta: post.callToAction,
          linkUrl: post.linkUrl,
          title: platformCode === "YOUTUBE" || platformCode === "PINTEREST" ? post.baseCaption.slice(0, 100) : null,
          description: post.baseCaption,
        },
        update: {
          caption: post.baseCaption,
          hashtags: post.baseHashtags,
          cta: post.callToAction,
          linkUrl: post.linkUrl,
        },
      });
    }

    return this.getPost(postId, user);
  }

  async validatePost(postId: string) {
    const post = await this.prisma.contentPost.findUnique({
      where: { id: postId },
      include: {
        variants: true,
        targets: true,
        mediaAsset: true,
      },
    });
    if (!post) throw new NotFoundException("Post not found");

    const errors: Array<{ code: string; message: string; platform?: string }> = [];
    const warnings: Array<{ code: string; message: string; platform?: string }> = [];

    if (!post.targets.length) {
      errors.push({ code: "NO_TARGETS", message: "Select at least one target account/platform" });
    }

    for (const target of post.targets) {
      const rule = PLATFORM_RULES[target.platformCode];
      const variant = post.variants.find((v) => v.platformCode === target.platformCode);
      const caption = variant?.caption ?? post.baseCaption;
      const title = variant?.title ?? "";
      // Prefer explicit description; otherwise use caption (composer UI keeps them in sync).
      const description = (variant?.description || caption || "").trim() ? variant?.description || caption : "";

      if (caption.length > rule.captionMax) {
        errors.push({
          code: "CAPTION_TOO_LONG",
          platform: target.platformCode,
          message: `${target.platformCode} caption exceeds ${rule.captionMax} characters (${caption.length}/${rule.captionMax})`,
        });
      }
      if (rule.requiresTitle && !title.trim()) {
        errors.push({
          code: "TITLE_REQUIRED",
          platform: target.platformCode,
          message: `${target.platformCode} requires a title`,
        });
      }
      if (rule.titleMax && title.length > rule.titleMax) {
        errors.push({
          code: "TITLE_TOO_LONG",
          platform: target.platformCode,
          message: `${target.platformCode} title exceeds ${rule.titleMax} (${title.length}/${rule.titleMax})`,
        });
      }
      if (rule.descriptionMax && description.length > rule.descriptionMax) {
        errors.push({
          code: "DESCRIPTION_TOO_LONG",
          platform: target.platformCode,
          message: `${target.platformCode} description exceeds ${rule.descriptionMax} (${description.length}/${rule.descriptionMax})`,
        });
      }
      if (rule.imageRequired && !post.mediaAsset) {
        errors.push({
          code: "MEDIA_REQUIRED",
          platform: target.platformCode,
          message: `${target.platformCode} requires media`,
        });
      }
      if (!rule.supportsLink && (variant?.linkUrl || post.linkUrl)) {
        warnings.push({
          code: "LINK_UNSUPPORTED",
          platform: target.platformCode,
          message: `${target.platformCode} may not support outbound links the same way`,
        });
      }

      if (target.socialAccountId) {
        const account = await this.prisma.socialAccount.findFirst({
          where: {
            id: target.socialAccountId,
            clientId: post.clientId,
            platformCode: target.platformCode,
            status: "CONNECTED",
          },
        });
        if (!account) {
          errors.push({
            code: "ACCOUNT_DISCONNECTED",
            platform: target.platformCode,
            message: `Connected ${target.platformCode} account is missing or disconnected`,
          });
        } else if (account.connectionMode === "mock") {
          warnings.push({
            code: "MOCK_ACCOUNT",
            platform: target.platformCode,
            message: `${target.platformCode} account is mock-connected; publishing will stay assisted until live OAuth`,
          });
        }
      } else {
        warnings.push({
          code: "NO_ACCOUNT",
          platform: target.platformCode,
          message: `No social account selected for ${target.platformCode}`,
        });
      }
    }

    if (post.scheduledAt && post.scheduledAt.getTime() < Date.now() - 60_000) {
      errors.push({ code: "SCHEDULE_PAST", message: "Scheduled time is in the past" });
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      checkedAt: new Date().toISOString(),
    };
  }

  async submit(postId: string, user: AuthUser, dto: SubmitPostDto) {
    const post = await this.getPost(postId, user);
    await this.assertCanManage(post.companyId, user);

    const validation = await this.validatePost(postId);
    if (!validation.ok && dto.action !== "DRAFT") {
      throw new BadRequestException({
        message: "Validation failed",
        validation,
      });
    }

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : post.scheduledAt;
    if (dto.scheduledAt || scheduledAt) {
      await this.prisma.contentPost.update({
        where: { id: postId },
        data: { scheduledAt, validationJson: validation as object },
      });
    } else {
      await this.prisma.contentPost.update({
        where: { id: postId },
        data: { validationJson: validation as object },
      });
    }

    if (dto.action === "PENDING_APPROVAL") {
      await this.approvals.startApprovalFlow(postId, user.id);
      const updated = await this.getPost(postId, user);
      return { post: updated, validation };
    }

    if (dto.action === "SCHEDULED" || dto.action === "PUBLISH_NOW") {
      const skipApproval = Boolean(dto.skipApproval) || post.status === "APPROVED";
      if (!skipApproval) {
        await this.approvals.startApprovalFlow(postId, user.id);
        if (scheduledAt) {
          await this.prisma.contentPost.update({
            where: { id: postId },
            data: { scheduledAt },
          });
        }
        const pending = await this.getPost(postId, user);
        return { post: pending, validation };
      }

      if (dto.action === "PUBLISH_NOW") {
        const updated = await this.prisma.contentPost.update({
          where: { id: postId },
          data: {
            status: "APPROVED",
            scheduledAt: null,
            validationJson: validation as object,
          },
          include: this.postInclude(),
        });
        await this.prisma.auditLog.create({
          data: {
            actorId: user.id,
            companyId: post.companyId,
            action: "POST_APPROVED_DIRECT",
            entityType: "ContentPost",
            entityId: postId,
            metadata: { validationOk: validation.ok, skipApproval: true },
          },
        });
        return { post: updated, validation };
      }

      const updated = await this.prisma.contentPost.update({
        where: { id: postId },
        data: {
          status: "SCHEDULED",
          scheduledAt,
          validationJson: validation as object,
        },
        include: this.postInclude(),
      });
      await this.prisma.postTarget.updateMany({
        where: { postId },
        data: { status: "SCHEDULED", scheduledAt },
      });
      await this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          companyId: post.companyId,
          action: "POST_SCHEDULED",
          entityType: "ContentPost",
          entityId: postId,
          metadata: { validationOk: validation.ok, skipApproval: true },
        },
      });
      return { post: updated, validation };
    }

    const updated = await this.prisma.contentPost.update({
      where: { id: postId },
      data: {
        status: "DRAFT",
        scheduledAt,
        validationJson: validation as object,
      },
      include: this.postInclude(),
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        companyId: post.companyId,
        action: "POST_DRAFT",
        entityType: "ContentPost",
        entityId: postId,
        metadata: { validationOk: validation.ok },
      },
    });

    return { post: updated, validation };
  }

  async duplicate(postId: string, user: AuthUser) {
    const post = await this.getPost(postId, user);
    await this.assertCanManage(post.companyId, user);

    const copy = await this.prisma.contentPost.create({
      data: {
        companyId: post.companyId,
        clientId: post.clientId,
        campaignId: post.campaignId,
        authorId: user.id,
        mediaAssetId: post.mediaAssetId,
        baseCaption: post.baseCaption,
        baseHashtags: post.baseHashtags,
        callToAction: post.callToAction,
        linkUrl: post.linkUrl,
        brandVoice: post.brandVoice,
        status: "DRAFT",
        variants: {
          create: post.variants.map((v) => ({
            platformCode: v.platformCode,
            caption: v.caption,
            title: v.title,
            description: v.description,
            hashtags: v.hashtags,
            cta: v.cta,
            linkUrl: v.linkUrl,
          })),
        },
        targets: {
          create: post.targets.map((t) => ({
            platformCode: t.platformCode,
            socialAccountId: t.socialAccountId,
            status: "PENDING",
          })),
        },
      },
      include: this.postInclude(),
    });

    return copy;
  }

  platformRules() {
    return PLATFORM_RULES;
  }

  private postInclude() {
    return {
      variants: true,
      targets: true,
      mediaAsset: true,
      campaign: true,
      client: { select: { id: true, name: true } },
    } as const;
  }

  private async assertClient(companyId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId, isArchived: false },
    });
    if (!client) throw new NotFoundException("Client not found");
    return client;
  }

  private async assertCanManage(companyId: string, user: AuthUser) {
    if (user.globalRole === "SUPER_ADMIN") return;
    const membership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
    });
    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenException("No company access");
    }
  }

  private async assertCanView(companyId: string, clientId: string, user: AuthUser) {
    if (user.globalRole === "SUPER_ADMIN") return;
    const companyMembership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
    });
    if (companyMembership?.status === "ACTIVE") return;
    const clientMembership = await this.prisma.clientMember.findUnique({
      where: { clientId_userId: { clientId, userId: user.id } },
    });
    if (clientMembership?.status === "ACTIVE") return;
    throw new ForbiddenException("No access to this post");
  }
}
