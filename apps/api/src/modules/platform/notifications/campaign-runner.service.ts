import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationsService } from "./notifications.service";

export interface RunnerRunResult {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
}

const DEFAULT_INTERVAL_MS = 30000;
const CLAIM_LIMIT = 10;

/**
 * Penjadwal eksekusi kampanye Fase 1: in-process `setInterval`, BUKAN
 * BullMQ (doc 08: Redis + BullMQ menyusul; paketnya belum dipasang dan
 * menambah dependency dilarang). Interval 30 detik memenuhi toleransi
 * ≤1 menit pada kriteria selesai F10 #1. Kunci antar-instance ada di
 * klaim repository (UPDATE bersyarat), bukan di sini.
 */
@Injectable()
export class CampaignRunnerService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly enabled: boolean;
  private readonly intervalMs: number;

  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {
    const raw = this.config.get<number>("CAMPAIGN_RUNNER_INTERVAL_MS");
    this.intervalMs =
      typeof raw === "number" && raw > 0 ? raw : DEFAULT_INTERVAL_MS;
    const nodeEnv = this.config.get<string>("NODE_ENV") ?? "development";
    const flag = this.config.get<string>("CAMPAIGN_RUNNER") ?? "on";
    this.enabled = nodeEnv !== "test" && flag !== "off";
  }

  onModuleInit(): void {
    if (!this.enabled) {
      return;
    }
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runOnce(
    now: Date = new Date(),
    limit: number = CLAIM_LIMIT,
  ): Promise<RunnerRunResult> {
    if (this.running) {
      return { claimed: 0, sent: 0, failed: 0, skipped: 0 };
    }
    this.running = true;
    try {
      const due = await this.notifications.claimDueCampaigns(now, limit);
      const result: RunnerRunResult = {
        claimed: due.length,
        sent: 0,
        failed: 0,
        skipped: 0,
      };
      for (const campaign of due) {
        let outcome: "sent" | "failed" | "skipped";
        try {
          outcome =
            await this.notifications.executeClaimedCampaign(campaign.id);
        } catch (error: unknown) {
          console.error(
            `Gagal mengeksekusi kampanye ${campaign.id}:`,
            error,
          );
          result.failed += 1;
          continue;
        }
        if (outcome === "sent") {
          result.sent += 1;
        } else if (outcome === "skipped") {
          result.skipped += 1;
        } else {
          result.failed += 1;
        }
      }
      return result;
    } finally {
      this.running = false;
    }
  }
}
