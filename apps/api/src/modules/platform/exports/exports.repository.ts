import { Injectable } from "@nestjs/common";
import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import type { Db } from "../../../database/database.service";
import type {
  ExportJobFilterJson,
  ExportJobRow,
  ExportSourceKey,
} from "../entities/export-jobs.entity";
import { exportJobs } from "../entities/export-jobs.entity";

export interface InsertExportJobRow {
  requestedBy: number;
  source: ExportSourceKey;
  appSlug: string | null;
  filter: ExportJobFilterJson;
}

@Injectable()
export class ExportsRepository {
  async insert(db: Db, row: InsertExportJobRow): Promise<ExportJobRow> {
    const rows = await db
      .insert(exportJobs)
      .values({ ...row, status: "queued" })
      .returning();
    const created = rows[0];
    if (!created) {
      throw new Error("Gagal membuat job ekspor.");
    }
    return created;
  }

  async findById(db: Db, id: number): Promise<ExportJobRow | null> {
    const rows = await db
      .select()
      .from(exportJobs)
      .where(eq(exportJobs.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async listByAdmin(
    db: Db,
    adminId: number,
    limit: number,
  ): Promise<ExportJobRow[]> {
    return db
      .select()
      .from(exportJobs)
      .where(eq(exportJobs.requestedBy, adminId))
      .orderBy(desc(exportJobs.createdAt))
      .limit(limit);
  }

  async findActiveByAdmin(
    db: Db,
    adminId: number,
  ): Promise<ExportJobRow | null> {
    const rows = await db
      .select()
      .from(exportJobs)
      .where(
        and(
          eq(exportJobs.requestedBy, adminId),
          inArray(exportJobs.status, ["queued", "running"]),
        ),
      )
      .orderBy(desc(exportJobs.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Klaim job queued untuk dieksekusi: tiap kandidat dikunci lewat
   * UPDATE bersyarat (status masih queued) sehingga dua instance tak
   * memproses job yang sama. Klaim yang kalah mengembalikan 0 baris.
   */
  async claimQueued(db: Db, now: Date, limit: number): Promise<ExportJobRow[]> {
    const due = await db
      .select({ id: exportJobs.id })
      .from(exportJobs)
      .where(eq(exportJobs.status, "queued"))
      .orderBy(asc(exportJobs.createdAt))
      .limit(limit);
    const claimed: ExportJobRow[] = [];
    for (const candidate of due) {
      const rows = await db
        .update(exportJobs)
        .set({ status: "running", updatedAt: now })
        .where(
          and(
            eq(exportJobs.id, candidate.id),
            eq(exportJobs.status, "queued"),
          ),
        )
        .returning();
      const row = rows[0];
      if (row) {
        claimed.push(row);
      }
    }
    return claimed;
  }

  async markDone(
    db: Db,
    id: number,
    patch: {
      rowCount: number;
      fileName: string;
      fileSizeBytes: number;
      expiresAt: Date;
      now: Date;
    },
  ): Promise<ExportJobRow> {
    const rows = await db
      .update(exportJobs)
      .set({
        status: "done",
        rowCount: patch.rowCount,
        fileName: patch.fileName,
        fileSizeBytes: patch.fileSizeBytes,
        expiresAt: patch.expiresAt,
        updatedAt: patch.now,
      })
      .where(eq(exportJobs.id, id))
      .returning();
    const updated = rows[0];
    if (!updated) {
      throw new Error("Gagal menandai job ekspor selesai.");
    }
    return updated;
  }

  async markFailed(
    db: Db,
    id: number,
    errorMessage: string,
    now: Date,
  ): Promise<void> {
    await db
      .update(exportJobs)
      .set({ status: "failed", errorMessage, updatedAt: now })
      .where(eq(exportJobs.id, id));
  }

  /**
   * Job selesai yang tautannya lewat masa berlaku → expired.
   * Mengembalikan baris yang berubah agar runner bisa menghapus file.
   */
  async expireDue(db: Db, now: Date): Promise<ExportJobRow[]> {
    return db
      .update(exportJobs)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(eq(exportJobs.status, "done"), lte(exportJobs.expiresAt, now)),
      )
      .returning();
  }

  /**
   * Job running yang macet (proses mati di tengah) → failed supaya
   * admin tidak terkunci permanen oleh batas satu job aktif.
   */
  async failStaleRunning(db: Db, now: Date, cutoff: Date): Promise<number> {
    const rows = await db
      .update(exportJobs)
      .set({
        status: "failed",
        errorMessage: "Ekspor terhenti sebelum selesai. Coba lagi.",
        updatedAt: now,
      })
      .where(
        and(
          eq(exportJobs.status, "running"),
          lte(exportJobs.updatedAt, cutoff),
        ),
      )
      .returning({ id: exportJobs.id });
    return rows.length;
  }

}

