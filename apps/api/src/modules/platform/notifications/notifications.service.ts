import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DatabaseService,
  type Db,
} from "../../../database/database.service";
import { ActivityLogService } from "../activity-logs/activity-log.service";
import { AppsRepository } from "../apps/apps.repository";
import { FcmCredentialService } from "../apps/fcm-credential.service";
import type {
  CampaignRow,
  CampaignSegmentCriteria,
  CampaignStatusValue,
  CampaignTargetTypeValue,
} from "../entities/notification-campaigns.entity";
import { DeviceTokensRepository } from "./device-tokens.repository";
import type {
  CampaignStatus,
  CreateCampaignInput,
  UpdateCampaignInput,
} from "./dto/campaign.input";
import { CampaignsRepository } from "./notifications.repository";
import type { CampaignFilters } from "./notifications.repository";
import { PUSH_SENDER } from "./push-sender";
import type { PushSendResult, PushSender } from "./push-sender";

export interface CampaignFilterInput {
  status?: CampaignStatus;
  search?: string;
}

export interface ListCampaignsInput {
  filter?: CampaignFilterInput;
  page?: number;
  perPage?: number;
}

export interface CampaignAuditContext {
  adminId: string;
  ip: string | null;
}

export interface CampaignItem {
  id: string;
  appId: string;
  createdBy: string;
  title: string;
  body: string;
  imageUrl: string | null;
  linkTarget: string | null;
  targetType: string;
  targetSegment: string | null;
  status: string;
  scheduledAt: Date | null;
  sentAt: Date | null;
  targetCount: number;
  sentCount: number;
  failedCount: number;
  simulatedCount: number;
  unknownCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CampaignSendOutcome = "sent" | "simulated" | "unknown" | "failed" | "skipped";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

function toItem(row: CampaignRow): CampaignItem {
  return {
    id: String(row.id),
    appId: String(row.appId),
    createdBy: String(row.createdBy),
    title: row.title,
    body: row.body,
    imageUrl: row.imageUrl,
    linkTarget: row.linkTarget,
    targetType: row.targetType,
    targetSegment:
      row.targetSegment === null ? null : JSON.stringify(row.targetSegment),
    status: row.status,
    scheduledAt: row.scheduledAt,
    sentAt: row.sentAt,
    targetCount: row.targetCount,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    simulatedCount: row.simulatedCount,
    unknownCount: row.unknownCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalize(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly campaigns: CampaignsRepository,
    private readonly tokens: DeviceTokensRepository,
    private readonly apps: AppsRepository,
    private readonly fcmCredentials: FcmCredentialService,
    private readonly activityLog: ActivityLogService,
    @Inject(PUSH_SENDER) private readonly sender: PushSender,
  ) {}

  private controlDb(): Db {
    return this.database.getControlPlaneConnection();
  }

  async list(
    appId: string,
    input: ListCampaignsInput,
  ): Promise<{ items: CampaignItem[]; total: number }> {
    const numericAppId = this.parseId(appId);
    const page =
      input.page !== undefined &&
      Number.isInteger(input.page) &&
      input.page > 0
        ? input.page
        : DEFAULT_PAGE;
    const perPage =
      input.perPage !== undefined &&
      Number.isInteger(input.perPage) &&
      input.perPage > 0
        ? Math.min(input.perPage, MAX_PER_PAGE)
        : DEFAULT_PER_PAGE;
    const filters: CampaignFilters = { appId: numericAppId };
    if (input.filter?.status !== undefined) {
      filters.status = input.filter.status;
    }
    if (input.filter?.search !== undefined) {
      filters.search = input.filter.search;
    }
    const db = this.controlDb();
    const [rows, total] = await Promise.all([
      this.campaigns.list(db, filters, {
        limit: perPage,
        offset: (page - 1) * perPage,
      }),
      this.campaigns.count(db, filters),
    ]);
    return { items: rows.map(toItem), total };
  }

  async getById(id: string, appId: string): Promise<CampaignItem> {
    const row = await this.mustFindScoped(id, appId);
    return toItem(row);
  }

  async createCampaign(
    appId: string,
    input: CreateCampaignInput,
    audit: CampaignAuditContext,
  ): Promise<CampaignItem> {
    const numericAppId = this.parseId(appId);
    const app = await this.apps.findById(this.controlDb(), numericAppId);
    if (!app) {
      throw new NotFoundException("Aplikasi tidak ditemukan.");
    }
    const targetType: CampaignTargetTypeValue = input.targetType ?? "all";
    const status: CampaignStatusValue =
      input.scheduledAt !== undefined && input.scheduledAt.getTime() > Date.now()
        ? "scheduled"
        : "draft";
    const created = await this.campaigns.insert(this.controlDb(), {
      appId: numericAppId,
      createdBy: this.parseId(audit.adminId),
      title: input.title.trim(),
      body: input.body.trim(),
      imageUrl: normalize(input.imageUrl),
      linkTarget: normalize(input.linkTarget),
      targetType,
      targetSegment: this.parseSegment(input.targetSegment),
      status,
      scheduledAt: input.scheduledAt ?? null,
    });
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: String(numericAppId),
      action: "create",
      entityType: "notification_campaign",
      entityId: String(created.id),
      summary: `Membuat kampanye notifikasi "${created.title}"`,
      ip: audit.ip,
    });
    return toItem(created);
  }

  async updateCampaign(
    id: string,
    appId: string,
    input: UpdateCampaignInput,
    audit: CampaignAuditContext,
  ): Promise<CampaignItem> {
    const existing = await this.mustFindScoped(id, appId);
    if (existing.status !== "draft" && existing.status !== "scheduled") {
      throw new BadRequestException(
        "Kampanye hanya bisa diubah saat berstatus draf atau terjadwal.",
      );
    }
    const scheduledAt =
      input.scheduledAt === undefined ? existing.scheduledAt : input.scheduledAt;
    const status: CampaignStatusValue =
      scheduledAt !== null && scheduledAt.getTime() > Date.now()
        ? "scheduled"
        : "draft";
    const updated = await this.campaigns.update(this.controlDb(), existing.id, {
      title:
        input.title === undefined ? existing.title : input.title.trim(),
      body: input.body === undefined ? existing.body : input.body.trim(),
      imageUrl:
        input.imageUrl === undefined
          ? existing.imageUrl
          : normalize(input.imageUrl),
      linkTarget:
        input.linkTarget === undefined
          ? existing.linkTarget
          : normalize(input.linkTarget),
      targetType:
        input.targetType ?? existing.targetType as CampaignTargetTypeValue,
      targetSegment:
        input.targetSegment === undefined
          ? existing.targetSegment
          : this.parseSegment(input.targetSegment),
      status,
      scheduledAt,
      updatedAt: new Date(),
    });
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: String(existing.appId),
      action: "update",
      entityType: "notification_campaign",
      entityId: String(updated.id),
      summary: `Mengubah kampanye notifikasi "${updated.title}"`,
      ip: audit.ip,
    });
    return toItem(updated);
  }

  async sendCampaignNow(
    id: string,
    appId: string,
    audit: CampaignAuditContext,
  ): Promise<CampaignItem> {
    const existing = await this.mustFindScoped(id, appId);
    if (existing.status !== "draft" && existing.status !== "scheduled") {
      throw new BadRequestException(
        "Kampanye hanya bisa dikirim saat berstatus draf atau terjadwal.",
      );
    }
    const claimed = await this.campaigns.claimForSend(this.controlDb(), existing.id, [
      "draft",
      "scheduled",
    ]);
    if (!claimed) {
      throw new ConflictException(
        "Kampanye sedang diproses pihak lain. Muat ulang daftar lalu coba lagi.",
      );
    }
    await this.deliver(claimed, audit, "admin");
    const row = await this.campaigns.findById(this.controlDb(), claimed.id);
    if (!row) {
      throw new NotFoundException("Kampanye tidak ditemukan.");
    }
    return toItem(row);
  }

  async cancelCampaign(
    id: string,
    appId: string,
    audit: CampaignAuditContext,
  ): Promise<CampaignItem> {
    const existing = await this.mustFindScoped(id, appId);
    if (existing.status !== "scheduled") {
      throw new BadRequestException(
        "Hanya kampanye terjadwal yang bisa dibatalkan.",
      );
    }
    const updated = await this.campaigns.update(this.controlDb(), existing.id, {
      status: "cancelled",
      updatedAt: new Date(),
    });
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: String(existing.appId),
      action: "cancel",
      entityType: "notification_campaign",
      entityId: String(updated.id),
      summary: `Membatalkan kampanye notifikasi "${updated.title}"`,
      ip: audit.ip,
    });
    return toItem(updated);
  }

  /** Klaim kampanye jatuh tempo untuk runner (lock di repository). */
  async claimDueCampaigns(now: Date, limit: number): Promise<CampaignRow[]> {
    return this.campaigns.claimDueCampaigns(this.controlDb(), now, limit);
  }

  async reconcileStaleSending(cutoff: Date): Promise<number> {
    const unknown = await this.campaigns.markStaleSendingUnknown(this.controlDb(), cutoff);
    for (const row of unknown) {
      await this.activityLog.record({
        adminId: String(row.createdBy),
        appId: String(row.appId),
        action: "send",
        entityType: "notification_campaign",
        entityId: String(row.id),
        summary: `Hasil kampanye "${row.title}" tidak dapat dipastikan setelah worker berhenti; pengiriman otomatis tidak diulang.`,
        ip: null,
      });
    }
    return unknown.length;
  }

  /**
   * Eksekusi satu kampanye ter-klaim dari runner. Audit memakai pembuat
   * kampanye karena runner tak punya admin (kolom audit wajib terisi).
   */
  async executeClaimedCampaign(id: number): Promise<CampaignSendOutcome> {
    const row = await this.campaigns.findById(this.controlDb(), id);
    if (!row || row.status !== "sending") {
      return "skipped";
    }
    return this.deliver(
      row,
      { adminId: String(row.createdBy), ip: null },
      "runner",
    );
  }

  /**
   * Inti pengiriman, dipakai aksi manual + runner. Koneksi App DB selalu
   * diturunkan dari aplikasi pemilik kampanye (isolasi kriteria 3).
   * Tanpa token → tercatat sukses dengan target 0, bukan error.
   */
  private async deliver(
    campaign: CampaignRow,
    audit: CampaignAuditContext,
    actor: "admin" | "runner",
  ): Promise<CampaignSendOutcome> {
    const db = this.controlDb();
    try {
      const app = await this.apps.findById(db, campaign.appId);
      if (!app) {
        const failed = await this.markFailed(
          campaign,
          audit,
          `Aplikasi pemilik kampanye (id ${campaign.appId}) tidak ditemukan.`,
        );
        return failed ? "failed" : "unknown";
      }
      if (app.status !== "active" && actor === "runner") {
        const restored = await this.campaigns.updateSending(db, campaign.id, {
          status: "scheduled",
          updatedAt: new Date(),
        });
        if (!restored) return "unknown";
        console.log(
          `Kampanye ${campaign.id} dilewati: aplikasi "${app.slug}" berstatus ${app.status}.`,
        );
        return "skipped";
      }
      const appDb = await this.database.getAppConnection(app.slug, {
        allowNonActive: true,
      });
      const tokens = await this.tokens.listTokens(appDb, {
        activeSince: this.activeSince(campaign),
      });
      if (tokens.length === 0) {
        const emptyStatus: CampaignStatusValue = this.sender.simulated
          ? "simulated"
          : "sent";
        const completed = await this.campaigns.updateSending(db, campaign.id, {
          status: emptyStatus,
          sentAt: emptyStatus === "sent" ? new Date() : null,
          targetCount: 0,
          sentCount: 0,
          failedCount: 0,
          simulatedCount: 0,
          unknownCount: 0,
          updatedAt: new Date(),
        });
        if (!completed) return "unknown";
        await this.activityLog.record({
          adminId: audit.adminId,
          appId: String(campaign.appId),
          action: "send",
          entityType: "notification_campaign",
          entityId: String(campaign.id),
          summary:
            `Mengirim kampanye "${campaign.title}": belum ada token ` +
            `perangkat, tercatat target 0.`,
          ip: audit.ip,
        });
        return emptyStatus;
      }
      const initialized = await this.campaigns.updateSending(db, campaign.id, {
        targetCount: tokens.length,
        sentCount: 0,
        failedCount: 0,
        simulatedCount: 0,
        unknownCount: tokens.length,
        updatedAt: new Date(),
      });
      if (!initialized) return "unknown";
      const credentialJson = app.fcmCredential
        ? this.fcmCredentials.decrypt(app.fcmCredential)
        : null;
      let sent = 0;
      let failed = 0;
      let simulated = 0;
      let unknown = 0;
      for (const item of tokens) {
        const result = await this.sendToToken(
          appDb,
          item.token,
          campaign,
          credentialJson,
        );
        if (result === "sent") sent += 1;
        else if (result === "simulated") simulated += 1;
        else if (result === "unknown") unknown += 1;
        else failed += 1;
        const heartbeat = await this.campaigns.updateSending(db, campaign.id, {
          sentCount: sent,
          failedCount: failed,
          simulatedCount: simulated,
          unknownCount: unknown,
          updatedAt: new Date(),
        });
        if (!heartbeat) return "unknown";
      }
      const status: CampaignStatusValue = unknown > 0
        ? "unknown"
        : simulated === tokens.length
          ? "simulated"
          : sent > 0
            ? "sent"
            : "failed";
      const completed = await this.campaigns.updateSending(db, campaign.id, {
        status,
        sentAt: status === "sent" ? new Date() : null,
        targetCount: tokens.length,
        sentCount: sent,
        failedCount: failed,
        simulatedCount: simulated,
        unknownCount: unknown,
        updatedAt: new Date(),
      });
      if (!completed) return "unknown";
      await this.activityLog.record({
        adminId: audit.adminId,
        appId: String(campaign.appId),
        action: "send",
        entityType: "notification_campaign",
        entityId: String(campaign.id),
        summary:
          `Mengirim kampanye "${campaign.title}" ke ${tokens.length} ` +
          `perangkat: ${sent} terkirim, ${simulated} simulasi, ${failed} gagal, ${unknown} tidak diketahui.` +
          (actor === "runner" ? " (terjadwal otomatis)" : ""),
        ip: audit.ip,
      });
      return status;
    } catch (error: unknown) {
      const reason =
        error instanceof Error ? error.message : "Kesalahan tak dikenal.";
      const markedFailed = await this.markFailed(campaign, audit, reason);
      return markedFailed ? "failed" : "unknown";
    }
  }

  /** Satu token: terkirim / gagal / basi (dihapus + dihitung gagal). */
  private async sendToToken(
    appDb: Db,
    token: string,
    campaign: CampaignRow,
    credentialJson: string | null,
  ): Promise<PushSendResult> {
    try {
      const result = await this.sender.send(campaign.appId, credentialJson, token, {
        title: campaign.title,
        body: campaign.body,
        imageUrl: campaign.imageUrl,
        linkTarget: campaign.linkTarget,
      });
      if (result === "invalid-token") {
        try {
          await this.tokens.deleteByToken(appDb, token);
        } catch (error: unknown) {
          console.error("Gagal menghapus token basi:", error);
        }
      }
      return result;
    } catch (error: unknown) {
      console.error("Gagal mengirim push:", error);
      return "unknown";
    }
  }

  /** Tandai gagal + catat alasannya di audit (tak ada kolom alasan). */
  private async markFailed(
    campaign: CampaignRow,
    audit: CampaignAuditContext,
    reason: string,
  ): Promise<boolean> {
    const updated = await this.campaigns.updateSending(this.controlDb(), campaign.id, {
      status: "failed",
      sentAt: null,
      updatedAt: new Date(),
    });
    if (!updated) return false;
    await this.activityLog.record({
      adminId: audit.adminId,
      appId: String(campaign.appId),
      action: "send",
      entityType: "notification_campaign",
      entityId: String(campaign.id),
      summary: `Pengiriman kampanye "${campaign.title}" gagal: ${reason}`,
      ip: audit.ip,
    });
    return true;
  }

  /** Batas `last_seen_at` dari kriteria segmen; undefined = semua token. */
  private activeSince(campaign: CampaignRow): Date | undefined {
    if (campaign.targetType !== "segment" || !campaign.targetSegment) {
      return undefined;
    }
    const days = campaign.targetSegment.last_active_days;
    if (
      typeof days !== "number" ||
      !Number.isInteger(days) ||
      days <= 0
    ) {
      return undefined;
    }
    return new Date(Date.now() - days * DAY_MS);
  }

  private async mustFindScoped(
    id: string,
    appId: string,
  ): Promise<CampaignRow> {
    const row = await this.campaigns.findById(
      this.controlDb(),
      this.parseId(id),
    );
    if (!row || row.appId !== this.parseId(appId)) {
      throw new NotFoundException("Kampanye tidak ditemukan.");
    }
    return row;
  }

  private parseId(id: string): number {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      throw new BadRequestException("ID tidak valid.");
    }
    return numeric;
  }

  /** Validasi JSON kriteria segmen; tak valid → BadRequest. */
  private parseSegment(
    value: string | null | undefined,
  ): CampaignSegmentCriteria | null {
    const text = normalize(value);
    if (text === null) {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new BadRequestException(
        "Segmen harus berupa JSON object yang valid.",
      );
    }
    if (typeof parsed !== "object" || parsed === null) {
      throw new BadRequestException(
        "Segmen harus berupa JSON object yang valid.",
      );
    }
    const record = parsed as Record<string, unknown>;
    const days = record["last_active_days"];
    if (
      days !== undefined &&
      (typeof days !== "number" || !Number.isInteger(days) || days <= 0)
    ) {
      throw new BadRequestException(
        "Segmen last_active_days harus bilangan bulat positif.",
      );
    }
    return days === undefined ? {} : { last_active_days: days };
  }
}
