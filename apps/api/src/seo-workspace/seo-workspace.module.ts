import { Module } from "@nestjs/common";
import { SeoWorkspaceController } from "./seo-workspace.controller";
import { SeoWorkspaceService } from "./seo-workspace.service";

@Module({
  controllers: [SeoWorkspaceController],
  providers: [SeoWorkspaceService],
})
export class SeoWorkspaceModule {}
