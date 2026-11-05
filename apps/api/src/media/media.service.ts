import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MediaKind } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { createReadStream, existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { extname, join } from "path";
import type { AuthUser } from "../auth/jwt.strategy";
import { EntitlementsService } from "../billing/entitlements.service";
import { PrismaService } from "../prisma/prisma.service";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, MEDIA_ROOT } from "./media.constants";

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {
    mkdirSync(MEDIA_ROOT, { recursive: true });
  }

  async list(companyId: string, clientId: string, query?: { q?: string; folder?: string }) {
    await this.assertClient(companyId, clientId);
    return this.prisma.mediaAsset.findMany({
      where: {
        companyId,
        clientId,
        folder: query?.folder || undefined,
        OR: query?.q
          ? [
              { originalName: { contains: query.q, mode: "insensitive" } },
              { tags: { has: query.q } },
            ]
          : undefined,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async upload(input: {
    companyId: string;
    clientId: string;
    user: AuthUser;
    file: Express.Multer.File;
    folder?: string;
    tags?: string[];
  }) {
    await this.assertCanManage(input.companyId, input.user);
    await this.assertClient(input.companyId, input.clientId);

    if (!input.file) throw new BadRequestException("File is required");
    if (!ALLOWED_MIME.has(input.file.mimetype)) {
      throw new BadRequestException(`Unsupported mime type: ${input.file.mimetype}`);
    }
    if (input.file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`File exceeds ${MAX_UPLOAD_BYTES} bytes`);
    }
    await this.entitlements.assertCanUpload(input.companyId, input.file.size);

    const kind: MediaKind = input.file.mimetype.startsWith("video/")
      ? "VIDEO"
      : input.file.mimetype.startsWith("image/")
        ? "IMAGE"
        : "OTHER";

    const ext = extname(input.file.originalname).slice(0, 12) || "";
    const filename = `${Date.now()}_${randomBytes(8).toString("hex")}${ext}`;
    const storageKey = join(input.companyId, input.clientId, filename);
    const abs = join(MEDIA_ROOT, storageKey);
    mkdirSync(join(MEDIA_ROOT, input.companyId, input.clientId), { recursive: true });
    writeFileSync(abs, input.file.buffer);

    const checksum = createHash("sha256").update(input.file.buffer).digest("hex");

    const asset = await this.prisma.mediaAsset.create({
      data: {
        companyId: input.companyId,
        clientId: input.clientId,
        uploadedById: input.user.id,
        kind,
        filename,
        originalName: input.file.originalname,
        mimeType: input.file.mimetype,
        sizeBytes: input.file.size,
        storageKey: storageKey.replace(/\\/g, "/"),
        folder: input.folder || "general",
        tags: input.tags ?? [],
        checksum,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: input.user.id,
        companyId: input.companyId,
        action: "MEDIA_UPLOADED",
        entityType: "MediaAsset",
        entityId: asset.id,
        metadata: { originalName: asset.originalName, sizeBytes: asset.sizeBytes, kind },
      },
    });

    return asset;
  }

  async getById(assetId: string) {
    return this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
  }

  async getAuthorized(assetId: string, user: AuthUser) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException("Media not found");
    await this.assertCanView(asset.companyId, asset.clientId, user);
    return asset;
  }

  openStream(asset: { storageKey: string; mimeType: string; originalName: string }) {
    const abs = join(MEDIA_ROOT, asset.storageKey);
    if (!existsSync(abs)) throw new NotFoundException("Media file missing on disk");
    return {
      stream: createReadStream(abs),
      mimeType: asset.mimeType,
      filename: asset.originalName,
    };
  }

  async remove(assetId: string, user: AuthUser) {
    const asset = await this.getAuthorized(assetId, user);
    await this.assertCanManage(asset.companyId, user);

    const inUse = await this.prisma.contentPost.count({ where: { mediaAssetId: assetId } });
    if (inUse > 0) {
      throw new BadRequestException("Media is attached to posts and cannot be deleted");
    }

    const abs = join(MEDIA_ROOT, asset.storageKey);
    if (existsSync(abs)) unlinkSync(abs);

    await this.prisma.mediaAsset.delete({ where: { id: assetId } });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        companyId: asset.companyId,
        action: "MEDIA_DELETED",
        entityType: "MediaAsset",
        entityId: assetId,
      },
    });
    return { ok: true };
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
    throw new ForbiddenException("No access to this media");
  }
}
