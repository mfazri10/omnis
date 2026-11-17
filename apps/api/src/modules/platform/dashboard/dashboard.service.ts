import { Inject, Injectable } from "@nestjs/common";
import {
  DatabaseService,
  type Db,
} from "../../../database/database.service";
import type { AppContext } from "../../../common/types/request-context";
import type { AppStatus } from "../entities/apps.entity";
import { AppsRepository } from "../apps/apps.repository";
import {
  ActivityLogService,
  type ActivityLogItem,
} from "../activity-logs/activity-log.service";
import { AppUsersRepository } from "../app-users/app-users.repository";
import { DashboardRepository } from "./dashboard.repository";
import {
  DASHBOARD_SECTIONS,
  type DashboardSection,
} from "./dashboard-section";

export interface PlatformAppCard {
  id: string;
  slug: string;
  name: string;
  status: AppStatus;
  userCount: number;
  activityCount7d: number;
}

export interface NotificationQueueSummary {
  scheduled: number;
  sending: number;
  failed: number;
}

export interface PlatformDashboardData {
  apps: PlatformAppCard[];
  recentActivity: ActivityLogItem[];
  notificationQueue: NotificationQueueSummary;
}

export interface AppDashboardSectionData {
  key: string;
  label: string;
  value: number;
  hint: string | null;
}

export interface AppCampaignSummary {
  draft: number;
  scheduled: number;
  sent: number;
  failed: number;
}

export interface AppDashboardData {
  app: { id: string; slug: string; name: string; status: AppStatus };
  sections: AppDashboardSectionData[];
  recentActivity: ActivityLogItem[];
  campaigns: AppCampaignSummary;
}

/**
 * Batas kerja paralel per dasbor global. Serial per aplikasi (N+1)
 * mengalikan latensi; Promise.all tanpa batas meledakkan koneksi saat
 * aplikasi banyak. Empat pekerja menyeimbangkan keduanya.
 */
export const DASHBOARD_CONCURRENCY = 4;

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_ACTIVITY_LIMIT = 10;

function countOf(counts: Record<string, number>, status: string): number {
  return counts[status] ?? 0;
}

/**
 * Petakan item dengan maksimal `limit` pekerja bersamaan, urutan hasil
 * mengikuti urutan masukan. Tiap aplikasi boleh gagal sendiri tanpa
 * menggagalkan yang lain bila `fn` menangkap galatnya.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const workerCount = Math.min(limit, items.length);
  const workers: Promise<void>[] = [];
  for (let worker = 0; worker < workerCount; worker += 1) {
    workers.push(
      (async (): Promise<void> => {
        while (next < items.length) {
          const index = next;
          next += 1;
          // Aman: index selalu < items.length dari kondisi while di atas.
          const item = items[index] as T;
          results[index] = await fn(item, index);
        }
      })(),
    );
  }
  await Promise.all(workers);
  return results;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly database: DatabaseService,
    private readonly apps: AppsRepository,
    private readonly activityLog: ActivityLogService,
    private readonly dashboard: DashboardRepository,
    private readonly appUsers: AppUsersRepository,
    @Inject(DASHBOARD_SECTIONS)
    private readonly sections: DashboardSection[],
  ) {}

  async platformDashboard(): Promise<PlatformDashboardData> {
    const controlDb = this.database.getControlPlaneConnection();
    const apps = await this.apps.list(controlDb, { statuses: null });
    const [activity, queue] = await Promise.all([
      this.activityLog.list({ page: 1, perPage: RECENT_ACTIVITY_LIMIT }),
      this.dashboard.countCampaignsByStatus(controlDb),
    ]);
    const since = new Date(Date.now() - 7 * DAY_MS);
    const cards = await mapWithConcurrency(
      apps,
      DASHBOARD_CONCURRENCY,
      async (app): Promise<PlatformAppCard> => {
        // Aktivitas tinggal di control-plane: selalu bisa dihitung meski
        // App DB aplikasi belum ada (provisioning gagal / terarsip).
        const activityCount7d = await this.dashboard.countActivitiesSince(
          controlDb,
          app.id,
          since,
        );
        return {
          id: String(app.id),
          slug: app.slug,
          name: app.name,
          status: app.status ?? "active",
          userCount: await this.countUsersSafely(app.slug, app.dbName),
          activityCount7d,
        };
      },
    );
    return {
      apps: cards,
      recentActivity: activity.items,
      notificationQueue: {
        scheduled: countOf(queue, "scheduled"),
        sending: countOf(queue, "sending"),
        failed: countOf(queue, "failed"),
      },
    };
  }

  async appDashboard(ctx: AppContext, db: Db): Promise<AppDashboardData> {
    // Section diambil dari token DI apa adanya: modul baru otomatis
    // muncul tanpa cabang if/else di service ini.
    const [sections, activity, campaigns] = await Promise.all([
      Promise.all(
        this.sections.map(
          async (section): Promise<AppDashboardSectionData> => {
            // Satu section gagal (bug modul penyumbang) tak boleh
            // meruntuhkan seluruh dasbor aplikasi.
            try {
              const resolved = await section.resolve({
                appId: ctx.appId,
                db,
              });
              return {
                key: section.key,
                label: section.label,
                value: resolved.value,
                hint: resolved.hint ?? null,
              };
            } catch (error: unknown) {
              console.error(
                `Dasbor section "${section.key}" gagal dihitung:`,
                error,
              );
              return {
                key: section.key,
                label: section.label,
                value: 0,
                hint: "Data tidak tersedia",
              };
            }
          },
        ),
      ),
      this.activityLog.list({
        filter: { appId: ctx.appId },
        page: 1,
        perPage: RECENT_ACTIVITY_LIMIT,
      }),
      this.dashboard.countCampaignsByStatus(
        this.database.getControlPlaneConnection(),
        Number(ctx.appId),
      ),
    ]);
    return {
      app: {
        id: ctx.appId,
        slug: ctx.slug,
        name: ctx.name,
        status: ctx.status,
      },
      sections,
      recentActivity: activity.items,
      campaigns: {
        draft: countOf(campaigns, "draft"),
        scheduled: countOf(campaigns, "scheduled"),
        sent: countOf(campaigns, "sent"),
        failed: countOf(campaigns, "failed"),
      },
    };
  }

  /**
   * Hitung user satu aplikasi; aplikasi tanpa App DB (gagal provision,
   * terarsip, DB dihapus manual) mengembalikan 0 tanpa melempar agar
   * dasbor global tetap tampil utuh.
   */
  private async countUsersSafely(
    slug: string,
    dbName: string,
  ): Promise<number> {
    try {
      // Cek murah dulu: jangan buka pool App DB yang memang tak ada.
      if (!(await this.database.databaseExists(dbName))) {
        return 0;
      }
      const appDb = await this.database.getAppConnection(slug, {
        allowNonActive: true,
      });
      return await this.appUsers.count(appDb, {});
    } catch (error: unknown) {
      console.error(
        `Dasbor melewati hitung user "${slug}" (App DB tak terbaca):`,
        error,
      );
      return 0;
    }
  }
}
