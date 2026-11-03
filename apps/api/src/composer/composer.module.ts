import { Module } from "@nestjs/common";
import { ApprovalsModule } from "../approvals/approvals.module";
import { ComposerController } from "./composer.controller";
import { ComposerService } from "./composer.service";

@Module({
  imports: [ApprovalsModule],
  controllers: [ComposerController],
  providers: [ComposerService],
  exports: [ComposerService],
})
export class ComposerModule {}
