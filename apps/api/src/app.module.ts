import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminModule } from "./admin/admin.module";
import { AiModule } from "./ai/ai.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { BrandingModule } from "./branding/branding.module";
import { ClientsModule } from "./clients/clients.module";
import { CompaniesModule } from "./companies/companies.module";
import { HealthModule } from "./health/health.module";
import { MailModule } from "./mail/mail.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ApprovalsModule } from "./approvals/approvals.module";
import { ComposerModule } from "./composer/composer.module";
import { MediaModule } from "./media/media.module";
import { PublishingModule } from "./publishing/publishing.module";
import { PublicModule } from "./public/public.module";
import { SocialModule } from "./social/social.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MailModule,
    HealthModule,
    PublicModule,
    AuthModule,
    BrandingModule,
    CompaniesModule,
    ClientsModule,
    SocialModule,
    MediaModule,
    ApprovalsModule,
    ComposerModule,
    PublishingModule,
    BillingModule,
    NotificationsModule,
    AiModule,
    AnalyticsModule,
    AdminModule,
  ],
})
export class AppModule {}
