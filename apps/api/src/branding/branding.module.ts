import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { BrandingController } from "./branding.controller";

@Module({
  imports: [AdminModule],
  controllers: [BrandingController],
})
export class BrandingModule {}
