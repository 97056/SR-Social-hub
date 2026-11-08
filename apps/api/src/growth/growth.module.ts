import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { GrowthAdminController } from "./growth-admin.controller";
import { GrowthClientController } from "./growth-client.controller";
import { GrowthController } from "./growth.controller";
import { GrowthEnabledGuard } from "./growth-enabled.guard";
import { GrowthService } from "./growth.service";

@Module({
  imports: [BillingModule],
  controllers: [GrowthController, GrowthClientController, GrowthAdminController],
  providers: [GrowthService, GrowthEnabledGuard],
  exports: [GrowthService],
})
export class GrowthModule {}
