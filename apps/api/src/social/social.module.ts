import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { SocialController } from "./social.controller";
import { SocialService } from "./social.service";

@Module({
  imports: [BillingModule],
  controllers: [SocialController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
