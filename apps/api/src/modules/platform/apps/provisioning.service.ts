import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../../../database/database.service";
import type { Db } from "../../../database/database.service";
import { migrateUp } from "../../../database/migration/migration-runner";
import { AppConfigsRepository } from "./app-configs.repository";
import { AppsRepository } from "./apps.repository";
import type { AppDetail } from "./apps.service";
import { AppsService } from "./apps.service";

export interface ProvisionAppInput {
  name: string;
  slug: string;
  iconMediaUrl?: string | null;
  androidPackage?: string | null;
  iosBundleId?: string | null;
  storeUrlAndroid?: string | null;
  storeUrlIos?: string | null;
  notes?: string | null;
  modules?: string[];
}

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{1,62}[a-z0-9])?$/;
const DEFAULT_TIMEOUT_MS = 30000;

@Injectable()
export class ProvisioningService {
  constructor(
    private readonly database: DatabaseService,
    private readonly apps: AppsRepository,
    private readonly configs: AppConfigsRepository,
    private readonly appService: AppsService,
    private readonly config: ConfigService,
  ) {}

  async provisionApp(input: ProvisionAppInput): Promise<AppDetail> {
    this.assertValidInput(input);
    return this.withProvisionLock(input.slug, async () => {
      const db = this.database.getControlPlaneConnection();
      const existing = await this.apps.findBySlug(db, input.slug);
      if (existing) {
        throw new ConflictException(
          `Slug "${input.slug}" sudah terdaftar.`,
        );
      }
      const dbName = toDbName(input.slug);
      const created = await this.apps.insert(db, {
        name: input.name,
        slug: input.slug,
        dbName,
        status: "provisioning",
        iconMediaUrl: input.iconMediaUrl ?? null,
        androidPackage: input.androidPackage ?? null,
        iosBundleId: input.iosBundleId ?? null,
        storeUrlAndroid: input.storeUrlAndroid ?? null,
        storeUrlIos: input.storeUrlIos ?? null,
        notes: input.notes ?? null,
        lastProvisioningAt: new Date(),
      });
      const compensations: string[] = [];
      try {
        await this.runStepsWithTimeout(db, created.id, dbName, compensations);
      } catch (error: unknown) {
        await this.compensate(db, created.id, dbName, compensations, error);
        throw error;
      }
      return this.appService.findBySlugDetailed(input.slug);
    });
  }

  async retryProvisionApp(slug: string): Promise<AppDetail> {
    const db = this.database.getControlPlaneConnection();
    const existing = await this.apps.findBySlug(db, slug);
    if (!existing) {
      throw new NotFoundException(
        `Tidak ada aplikasi dengan slug "${slug}".`,
      );
    }
    if (existing.status !== "failed") {
      throw new BadRequestException(
        "Hanya aplikasi gagal yang bisa diulang.",
      );
    }
    return this.withProvisionLock(slug, async () => {
      await this.database.dropDatabaseIfExists(existing.dbName);
      await this.configs.deleteByAppId(db, existing.id);
      await this.apps.updateById(db, existing.id, {
        status: "provisioning",
        failureReason: null,
        lastProvisioningAt: new Date(),
      });
      const compensations: string[] = [];
      try {
        await this.runStepsWithTimeout(db, existing.id, existing.dbName, compensations);
      } catch (error: unknown) {
        await this.compensate(
          db,
          existing.id,
          existing.dbName,
          compensations,
          error,
        );
        throw error;
      }
      return this.appService.findBySlugDetailed(slug);
    });
  }

  private async runStepsWithTimeout(
    db: Db,
    appId: number,
    dbName: string,
    compensations: string[],
  ): Promise<void> {
    const timeoutMs = this.config.get<number>(
      "PROVISION_TIMEOUT_MS",
      DEFAULT_TIMEOUT_MS,
    );
    await this.withTimeout(timeoutMs, async (signal) => {
      this.assertNotAborted(signal);
      await this.database.createDatabase(dbName);
      compensations.push("database");
      this.assertNotAborted(signal);
      await this.database.withAppDbConnection(dbName, (appDb) =>
        migrateUp("app-template", appDb),
      );
      this.assertNotAborted(signal);
      await this.configs.insertDefault(db, appId);
      compensations.push("config");
      this.assertNotAborted(signal);
      await this.apps.updateById(db, appId, {
        status: "active",
        failureReason: null,
      });
    });
  }

  private async compensate(
    db: Db,
    appId: number,
    dbName: string,
    compensations: string[],
    originalError: unknown,
  ): Promise<void> {
    const failed: string[] = [];
    for (const step of [...compensations].reverse()) {
      try {
        if (step === "config") {
          await this.configs.deleteByAppId(db, appId);
        } else {
          await this.database.dropDatabaseIfExists(dbName);
        }
      } catch (compError: unknown) {
        failed.push(
          `${step}: ${compError instanceof Error ? compError.message : String(compError)}`,
        );
      }
    }
    const reason = [
      `Error: ${originalError instanceof Error ? originalError.message : String(originalError)}`,
      ...(failed.length > 0
        ? [`Kompensasi gagal: ${failed.join("; ")}`]
        : []),
    ].join("\n");
    try {
      await this.apps.updateById(db, appId, {
        status: "failed",
        failureReason: reason,
      });
    } catch {
      console.error(
        `CRITICAL: gagal menandai failed appId=${appId}: ${reason}`,
      );
    }
  }

  private async withProvisionLock<T>(
    slug: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.database.withControlPlaneClient(async (client) => {
      const result = await client.query(
        "SELECT pg_try_advisory_lock(hashtext('provision:' || $1)) AS acquired",
        [slug],
      );
      const rows = result.rows as Array<{ acquired: unknown }>;
      if (rows[0]?.acquired !== true) {
        throw new ConflictException(
          `Provisioning untuk slug "${slug}" sedang berjalan.`,
        );
      }
      try {
        return await fn();
      } finally {
        await client.query(
          "SELECT pg_advisory_unlock(hashtext('provision:' || $1))",
          [slug],
        );
      }
    });
  }

  private async withTimeout<T>(
    ms: number,
    fn: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    const run = fn(controller.signal);
    // Cegah unhandled rejection bila timeout menang duluan;
    // race di bawah tetap menerima error asli fn bila fn kalah cepat.
    void run.catch(() => undefined);
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new RequestTimeoutException("Provisioning timeout"));
      }, ms);
    });
    try {
      return await Promise.race([run, timeout]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  private assertNotAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new RequestTimeoutException("Provisioning timeout");
    }
  }

  private assertValidInput(input: ProvisionAppInput): void {
    if (!SLUG_PATTERN.test(input.slug)) {
      throw new BadRequestException(
        `Slug "${input.slug}" tidak valid (huruf kecil/angka/strip, 3–64 karakter).`,
      );
    }
    if (input.modules && input.modules.length > 0) {
      throw new BadRequestException(
        `Modul domain (${input.modules.join(", ")}) tersedia mulai Fase 2.`,
      );
    }
  }
}

function toDbName(slug: string): string {
  return `app_${slug.replace(/-/g, "_")}`;
}
