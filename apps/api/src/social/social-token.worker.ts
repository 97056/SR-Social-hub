import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SocialService } from "./social.service";

/**
 * Keeps connected social accounts alive by refreshing OAuth tokens before expiry.
 * Accounts are never auto-disconnected — only the user Disconnect action does that.
 */
@Injectable()
export class SocialTokenWorker implements OnModuleInit {
  private readonly logger = new Logger(SocialTokenWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly social: SocialService) {}

  onModuleInit() {
    const enabled = process.env.SOCIAL_TOKEN_WORKER_ENABLED !== "false";
    const intervalMs = Number(process.env.SOCIAL_TOKEN_POLL_MS ?? 10 * 60_000);
    if (!enabled) {
      this.logger.warn("Social token keep-alive worker disabled");
      return;
    }
    this.logger.log(`Social token keep-alive every ${intervalMs}ms`);
    // First pass shortly after boot, then on interval.
    setTimeout(() => void this.tick(), 15_000);
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.social.refreshExpiringAccounts(50);
      if (result.scanned > 0) {
        this.logger.log(
          `Token keep-alive: scanned=${result.scanned} refreshed=${result.refreshed} failed=${result.failed}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Token keep-alive failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
