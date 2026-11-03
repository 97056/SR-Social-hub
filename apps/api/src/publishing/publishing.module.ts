import { Module } from "@nestjs/common";
import { ApprovalsModule } from "../approvals/approvals.module";
import { BillingModule } from "../billing/billing.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PublishingController } from "./publishing.controller";
import { PublishingService } from "./publishing.service";
import { PublishingWorker } from "./publishing.worker";

@Module({
  imports: [ApprovalsModule, BillingModule, NotificationsModule],
  controllers: [PublishingController],
  providers: [PublishingService, PublishingWorker],
  exports: [PublishingService],
})
export class PublishingModule {}
