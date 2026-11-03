import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { memoryStorage } from "multer";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CompanyAccessGuard } from "../common/guards/company-access.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { MAX_UPLOAD_BYTES } from "./media.constants";
import { MediaService } from "./media.service";

@ApiTags("media")
@ApiBearerAuth()
@Controller()
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Get("companies/:companyId/clients/:clientId/media")
  list(
    @Param("companyId") companyId: string,
    @Param("clientId") clientId: string,
    @Query("q") q?: string,
    @Query("folder") folder?: string,
  ) {
    return this.media.list(companyId, clientId, { q, folder });
  }

  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Post("companies/:companyId/clients/:clientId/media")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        folder: { type: "string" },
        tags: { type: "string" },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  upload(
    @Param("companyId") companyId: string,
    @Param("clientId") clientId: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Query("folder") folder?: string,
    @Query("tags") tags?: string,
  ) {
    return this.media.upload({
      companyId,
      clientId,
      user,
      file,
      folder,
      tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get("media/:assetId/file")
  async file(
    @Param("assetId") assetId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const asset = await this.media.getAuthorized(assetId, user);
    const opened = this.media.openStream(asset);
    res.setHeader("Content-Type", opened.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${opened.filename.replace(/"/g, "")}"`,
    );
    res.setHeader("Cache-Control", "private, max-age=60");
    opened.stream.pipe(res);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("media/:assetId")
  remove(@Param("assetId") assetId: string, @CurrentUser() user: AuthUser) {
    return this.media.remove(assetId, user);
  }
}
