import { Module, forwardRef } from "@nestjs/common";
import { ApprovalsModule } from "../approvals/approvals.module";
import { PublishingModule } from "../publishing/publishing.module";
import { ComposerController } from "./composer.controller";
import { ComposerService } from "./composer.service";

@Module({
  imports: [ApprovalsModule, forwardRef(() => PublishingModule)],
  controllers: [ComposerController],
  providers: [ComposerService],
  exports: [ComposerService],
})
export class ComposerModule {}
