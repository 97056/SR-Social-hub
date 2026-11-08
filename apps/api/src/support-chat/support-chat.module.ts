import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { SupportChatController } from "./support-chat.controller";
import { SupportChatService } from "./support-chat.service";

@Module({
  imports: [AdminModule],
  controllers: [SupportChatController],
  providers: [SupportChatService],
})
export class SupportChatModule {}
