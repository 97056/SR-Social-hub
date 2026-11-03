import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PublishingService } from "./publishing.service";

@Injectable()
export class PublishingWorker implements OnModuleInit {
  private readonly logger = new Logger(PublishingWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly publishing: PublishingService) {}

  onModuleInit() {
    const enabled = process.env.PUBLISHING_WORKER_ENABLED !== "false";
    const intervalMs = Number(process.env.PUBLISHING_POLL_MS ?? 5000);
    if (!enabled) {
      this.logger.warn("Publishing worker disabled via PUBLISHING_WORKER_ENABLED=false");
      return;
    }
    this.logger.log(`Publishing worker polling every ${intervalMs}ms`);
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const results = await this.publishing.processDueJobs(10);
      if (results.length) {
        this.logger.log(`Processed ${results.length} publishing job(s)`);
      }
    } catch (error) {
      this.logger.error(
        `Worker tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
