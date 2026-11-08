import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { GrowthModule } from "../growth/growth.module";
import { PublicController } from "./public.controller";

@Module({
  imports: [AdminModule, GrowthModule],
  controllers: [PublicController],
})
export class PublicModule {}
