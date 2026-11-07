import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { PublicController } from "./public.controller";

@Module({
  imports: [AdminModule],
  controllers: [PublicController],
})
export class PublicModule {}
