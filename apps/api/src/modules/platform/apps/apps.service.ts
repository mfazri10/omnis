import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../../../database/database.service";
import type { Db } from "../../../database/database.service";
import type { AppRow, AppStatus } from "../entities/apps.entity";
import { AppConfigsRepository } from "./app-configs.repository";
import { AppsRepository } from "./apps.repository";
import type { UpdateAppRow } from "./apps.repository";
import { FcmCredentialService } from "./fcm-credential.service";
import { AssignmentsRepository } from "../rbac/assignments.repository";

export interface AppDetail {
  id: string;
  name: string;
  slug: string;
  iconMediaUrl: string | null;
  status: AppStatus;
  dbName: string;
  androidPackage: string | null;
  iosBundleId: string | null;
  storeUrlAndroid: string | null;
  storeUrlIos: string | null;
  notes: string | null;
  failureReason: string | null;
  lastProvisioningAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  fcmConfigured: boolean;
}

export interface UpdateAppPatch {
  name?: string;
  notes?: string | null;
  iconMediaUrl?: string | null;
  androidPackage?: string | null;
  iosBundleId?: string | null;
  storeUrlAndroid?: string | null;
  storeUrlIos?: string | null;
}

const ALL_STATUSES: AppStatus[] = [
  "active",
  "suspended",
  "archived",
  "provisioning",
  "failed",
];

function toDetail(row: AppRow): AppDetail {
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    iconMediaUrl: row.iconMediaUrl,
    status: row.status,
    dbName: row.dbName,
    androidPackage: row.androidPackage,
    iosBundleId: row.iosBundleId,
    storeUrlAndroid: row.storeUrlAndroid,
    storeUrlIos: row.storeUrlIos,
    notes: row.notes,
    failureReason: row.failureReason,
    lastProvisioningAt: row.lastProvisioningAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    fcmConfigured: row.fcmCredential !== null,
  };
}

function isServiceAccount(value: unknown): value is {
  project_id: string;
  private_key: string;
  client_email: string;
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.project_id === "string" &&
    typeof record.private_key === "string" &&
    typeof record.client_email === "string"
  );
}

@Injectable()
export class AppsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly apps: AppsRepository,
    private readonly configs: AppConfigsRepository,
    private readonly fcm: FcmCredentialService,
    private readonly assignments: AssignmentsRepository,
  ) {}

  async listAccessibleApps(profile: {
    id: string;
    isSuperAdmin: boolean;
  }): Promise<AppDetail[]> {
    const db = this.database.getControlPlaneConnection();
    if (profile.isSuperAdmin) {
      const rows = await this.apps.list(db, {
        statuses: ["active", "suspended"],
      });
      return rows.map(toDetail);
    }
    const adminId = Number(profile.id);
    if (!Number.isInteger(adminId) || adminId <= 0) {
      throw new BadRequestException("ID tidak valid.");
    }
    const grants = await this.assignments.listByAdmin(db, adminId);
    if (grants.some((grant) => grant.scopeType === "global")) {
      const rows = await this.apps.listActive(db);
      return rows.map(toDetail);
    }
    const ids = [
      ...new Set(
        grants
          .map((grant) => grant.appId)
          .filter((appId): appId is number => appId !== null),
      ),
    ];
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.apps.findByIds(db, ids);
    return rows
      .filter((row) => row.status === "active")
      .map(toDetail);
  }

  async listApps(query: {
    status?: string;
    search?: string;
  }): Promise<AppDetail[]> {
    let statuses: AppStatus[] | null = ["active"];
    if (query.status !== undefined) {
      if (query.status === "all") {
        statuses = null;
      } else if (
        (ALL_STATUSES as string[]).includes(query.status)
      ) {
        statuses = [query.status as AppStatus];
      } else {
        throw new BadRequestException("Status tidak valid.");
      }
    }
    const rows = await this.apps.list(this.database.getControlPlaneConnection(), {
      statuses,
      search: query.search,
    });
    return rows.map(toDetail);
  }

  async findBySlugDetailed(slug: string): Promise<AppDetail> {
    const row = await this.apps.findBySlug(
      this.database.getControlPlaneConnection(),
      slug,
    );
    if (!row) {
      throw new NotFoundException("Aplikasi tidak ditemukan.");
    }
    return toDetail(row);
  }

  async updateApp(
    id: string,
    patch: UpdateAppPatch & { name?: string | null },
  ): Promise<AppDetail> {
    const db = this.database.getControlPlaneConnection();
    const existing = await this.mustFind(db, id);
    const { name, ...rest } = patch;
    if (name === null) {
      throw new BadRequestException("Nama tidak boleh kosong.");
    }
    const clean: UpdateAppRow = { ...rest };
    if (name !== undefined) {
      clean.name = name;
    }
    if (Object.keys(clean).length === 0) {
      throw new BadRequestException("Tidak ada field yang diubah.");
    }
    await this.apps.updateById(db, existing.id, clean);
    const updated = await this.apps.findById(db, existing.id);
    if (!updated) {
      throw new NotFoundException("Aplikasi tidak ditemukan.");
    }
    return toDetail(updated);
  }

  async suspendApp(id: string): Promise<AppDetail> {
    return this.transition(id, "active", "suspended", true);
  }

  async unsuspendApp(id: string): Promise<AppDetail> {
    return this.transition(id, "suspended", "active", false);
  }

  async archiveApp(id: string): Promise<AppDetail> {
    const db = this.database.getControlPlaneConnection();
    const existing = await this.mustFind(db, id);
    if (existing.status !== "active" && existing.status !== "suspended") {
      throw new BadRequestException(
        "Hanya aplikasi aktif atau suspended yang bisa diarsipkan.",
      );
    }
    await this.apps.updateById(db, existing.id, { status: "archived" });
    await this.database.closeAppPool(existing.slug);
    return toDetail({ ...existing, status: "archived" });
  }

  async deleteApp(id: string): Promise<{ id: string; name: string }> {
    const db = this.database.getControlPlaneConnection();
    const existing = await this.mustFind(db, id);
    if (existing.status !== "failed") {
      throw new BadRequestException("Hanya aplikasi gagal yang bisa dihapus.");
    }
    try {
      await this.database.dropDatabaseIfExists(existing.dbName);
    } catch {
      // Best effort: DB mungkin sudah tak ada; registry tetap dibersihkan.
    }
    await this.configs.deleteByAppId(db, existing.id);
    await this.apps.deleteById(db, existing.id);
    return { id: String(existing.id), name: existing.name };
  }

  async setFcmCredential(
    id: string,
    jsonString: string,
  ): Promise<{ id: string; name: string }> {
    const db = this.database.getControlPlaneConnection();
    const existing = await this.mustFind(db, id);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString) as unknown;
    } catch {
      throw new BadRequestException("Kredensial FCM bukan JSON valid.");
    }
    if (!isServiceAccount(parsed)) {
      throw new BadRequestException(
        "Service account tidak lengkap (project_id/private_key/client_email).",
      );
    }
    const cipher = this.fcm.encrypt(jsonString);
    await this.apps.updateById(db, existing.id, { fcmCredential: cipher });
    return { id: String(existing.id), name: existing.name };
  }

  private async transition(
    id: string,
    from: AppStatus,
    to: AppStatus,
    closePool: boolean,
  ): Promise<AppDetail> {
    const db = this.database.getControlPlaneConnection();
    const existing = await this.mustFind(db, id);
    if (existing.status !== from) {
      const action = to === "suspended" ? "di-suspend" : "diaktifkan";
      const expected = from === "active" ? "aktif" : from;
      throw new BadRequestException(
        `Hanya aplikasi ${expected} yang bisa ${action}.`,
      );
    }
    await this.apps.updateById(db, existing.id, { status: to });
    if (closePool) {
      await this.database.closeAppPool(existing.slug);
    }
    return toDetail({ ...existing, status: to });
  }

  private async mustFind(db: Db, id: string): Promise<AppRow> {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new BadRequestException("ID tidak valid.");
    }
    const row = await this.apps.findById(db, numericId);
    if (!row) {
      throw new NotFoundException("Aplikasi tidak ditemukan.");
    }
    return row;
  }
}
