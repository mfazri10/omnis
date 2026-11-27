import { NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, Worker } from "bullmq";
import type { Job, RedisOptions } from "bullmq";
import { AppModule } from "./app.module";
import { CampaignRunnerService } from "./modules/platform/notifications/campaign-runner.service";
import { NotificationsService } from "./modules/platform/notifications/notifications.service";
import { ExportRunnerService } from "./modules/platform/exports/export-runner.service";
import { closeWorkerResources } from "./worker-lifecycle";

const CAMPAIGN_QUEUE = "platform-campaign-sweep";
const EXPORT_QUEUE = "platform-export-sweep";

function bullConnection(url: string): RedisOptions {
  const parsed = new URL(url);
  const db = parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0;
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(Number.isInteger(db) && db > 0 ? { db } : {}),
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

async function bootstrap(): Promise<void> {
  process.env.CAMPAIGN_RUNNER = "off";
  process.env.EXPORT_RUNNER = "off";
  let app: INestApplicationContext | undefined;
  const queues: Queue[] = [];
  const workers: Worker[] = [];
  let shutdownPromise: Promise<void> | undefined;
  const closeResources = (): Promise<void> =>
    closeWorkerResources(workers, queues, app);
  const shutdown = (): Promise<void> => {
    shutdownPromise ??= closeResources();
    return shutdownPromise;
  };

  try {
    app = await NestFactory.createApplicationContext(AppModule);
    const config = app.get(ConfigService);
    const connection = bullConnection(process.env.REDIS_URL ?? "redis://localhost:6379");
    const campaigns = app.get(CampaignRunnerService);
    const notifications = app.get(NotificationsService);
    const exports = app.get(ExportRunnerService);
    const campaignInterval = config.get<number>("CAMPAIGN_RUNNER_INTERVAL_MS", 30_000);
    const exportInterval = config.get<number>("EXPORT_RUNNER_INTERVAL_MS", 5_000);
    const campaignQueue = new Queue(CAMPAIGN_QUEUE, { connection });
    queues.push(campaignQueue);
    const exportQueue = new Queue(EXPORT_QUEUE, { connection });
    queues.push(exportQueue);
    workers.push(new Worker(CAMPAIGN_QUEUE, async (_job: Job) => {
      await notifications.reconcileStaleSending(new Date(Date.now() - 10 * 60_000));
      return campaigns.runOnce();
    }, {
      connection,
      concurrency: 1,
    }));
    workers.push(new Worker(EXPORT_QUEUE, async (_job: Job) => exports.runOnce(), {
      connection,
      concurrency: 1,
    }));
    for (const worker of workers) {
      worker.on("failed", (job, error) => {
        console.error(`Worker job ${job?.name ?? "unknown"} gagal:`, error);
      });
    }
    await Promise.all([
      campaignQueue.upsertJobScheduler(
        "campaign-sweep",
        { every: campaignInterval },
        { name: "campaign-sweep", data: {} },
      ),
      exportQueue.upsertJobScheduler(
        "export-sweep",
        { every: exportInterval },
        { name: "export-sweep", data: {} },
      ),
    ]);

    process.once("SIGINT", () => void shutdown().catch((error: unknown) => {
      console.error("Gagal menutup worker:", error);
      process.exitCode = 1;
    }));
    process.once("SIGTERM", () => void shutdown().catch((error: unknown) => {
      console.error("Gagal menutup worker:", error);
      process.exitCode = 1;
    }));
    console.log("BullMQ campaign and export workers started.");
  } catch (error: unknown) {
    try {
      await shutdown();
    } catch (cleanupError: unknown) {
      console.error("Gagal membersihkan resource worker:", cleanupError);
    }
    throw error;
  }
}

void bootstrap().catch((error: unknown) => {
  console.error("Gagal menjalankan worker:", error);
  process.exitCode = 1;
});
