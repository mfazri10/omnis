import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ExportsService } from "./exports.service";

export interface ExportRunnerRunResult {
  claimed: number;
  done: number;
  failed: number;
  skipped: number;
}

const DEFAULT_INTERVAL_MS = 5000;
const CLAIM_LIMIT = 5;

/**
 * Penjadwal eksekusi ekspor Fase 1: in-process `setInterval`, BUKAN
 * BullMQ (paketnya belum dipasang dan menambah dependency dilarang).
 * Kunci antar-instance ada di klaim repository (UPDATE bersyarat).
 */
@Injectable()
export class ExportRunnerService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly enabled: boolean;
  private readonly intervalMs: number;

  constructor(
    private readonly exports: ExportsService,
    private readonly config: ConfigService,
  ) {
    const raw = this.config.get<number>("EXPORT_RUNNER_INTERVAL_MS");
    this.intervalMs =
      typeof raw === "number" && raw > 0 ? raw : DEFAULT_INTERVAL_MS;
    const nodeEnv = this.config.get<string>("NODE_ENV") ?? "development";
    const flag = this.config.get<string>("EXPORT_RUNNER") ?? "on";
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
  ): Promise<ExportRunnerRunResult> {
    if (this.running) {
      return { claimed: 0, done: 0, failed: 0, skipped: 0 };
    }
    this.running = true;
    try {
      await this.exports.sweep(now);
      const due = await this.exports.claimQueued(now, limit);
      const result: ExportRunnerRunResult = {
        claimed: due.length,
        done: 0,
        failed: 0,
        skipped: 0,
      };
      for (const job of due) {
        let outcome: "done" | "failed" | "skipped";
        try {
          outcome = await this.exports.executeClaimed(job.id);
        } catch (error: unknown) {
          console.error(
            `Gagal mengeksekusi job ekspor ${job.id}:`,
            error,
          );
          result.failed += 1;
          continue;
        }
        if (outcome === "done") {
          result.done += 1;
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
