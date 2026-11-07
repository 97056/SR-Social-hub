import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { AnalysisService } from "./analysis.service";

@Module({
  imports: [BillingModule],
  controllers: [AiController],
  providers: [AiService, AnalysisService],
  exports: [AiService, AnalysisService],
})
export class AiModule {}
