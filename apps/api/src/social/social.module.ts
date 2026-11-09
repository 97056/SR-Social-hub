import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { SocialController } from "./social.controller";
import { SocialService } from "./social.service";
import { SocialTokenWorker } from "./social-token.worker";

@Module({
  imports: [BillingModule],
  controllers: [SocialController],
  providers: [SocialService, SocialTokenWorker],
  exports: [SocialService],
})
export class SocialModule {}
