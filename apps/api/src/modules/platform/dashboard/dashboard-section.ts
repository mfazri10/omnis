import type { Db } from "../../../database/database.service";

/**
 * Kontrak kontribusi dasbor (F07, kriteria 3): tiap modul domain
 * menyumbang satu kartu statistik lewat interface ini. Service dasbor
 * hanya membaca array dari token DI — tanpa if/else per modul —
 * sehingga modul baru (mis. F12) tak menyentuh kode dasbor.
 */
export interface DashboardSection {
  /** Kunci stabil kartu, mis. "users". */
  key: string;
  /** Label Bahasa Indonesia, mis. "User Aplikasi". */
  label: string;
  /**
   * Hitung angka kartu. `db` = koneksi App DB konteks; `appId` = id
   * aplikasi konteks (string GraphQL ID).
   */
  resolve(ctx: { appId: string; db: Db }): Promise<{
    value: number;
    hint?: string;
  }>;
}

/** Token DI multi-provider untuk semua DashboardSection. */
export const DASHBOARD_SECTIONS = "DASHBOARD_SECTIONS";
