import { Injectable } from "@nestjs/common";
import type { Db } from "../../database/database.service";
import type { DashboardSection } from "../platform/dashboard/dashboard-section";
import { CbtQuestionsRepository } from "./questions.repository";

/**
 * Kartu "Soal CBT" untuk dasbor per aplikasi (F07, pola F12): jumlah
 * soal aktif di App DB konteks. Aplikasi tanpa modul CBT (tabel belum
 * dimigrasi) mengembalikan 0 dengan hint jelas, bukan error: dasbor
 * semua aplikasi tetap tampil utuh.
 */
@Injectable()
export class CbtDashboardSection implements DashboardSection {
  readonly key = "cbt_questions";
  readonly label = "Soal CBT";

  constructor(private readonly questions: CbtQuestionsRepository) {}

  async resolve(ctx: { appId: string; db: Db }): Promise<{
    value: number;
    hint?: string;
  }> {
    void ctx.appId;
    try {
      const value = await this.questions.count(ctx.db, { isActive: true });
      return { value, hint: `${value} soal aktif` };
    } catch (error: unknown) {
      if (isUndefinedTable(error)) {
        return { value: 0, hint: "Modul CBT belum terpasang di aplikasi ini" };
      }
      throw error;
    }
  }
}

/**
 * Pesan tunggal untuk aplikasi yang belum memasang modul CBT (tabel
 * belum dimigrasi). Dipakai interceptor resolver DAN sumber ekspor
 * hasil CBT supaya jawabannya konsisten di semua jalur.
 */
export const CBT_TABLES_MISSING_MESSAGE =
  "Modul CBT belum terpasang di aplikasi ini. Terapkan migrasi app-cbt ke App DB aplikasi.";

export function isUndefinedTable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  // Drizzle membungkus DatabaseError pg sebagai `cause`; driverError
  // dipakai versi lama. Ketiganya diperiksa agar tahan perubahan versi.
  const e = error as {
    code?: unknown;
    driverError?: { code?: unknown };
    cause?: { code?: unknown };
  };
  return (
    e.code === "42P01" ||
    e.driverError?.code === "42P01" ||
    e.cause?.code === "42P01"
  );
}
