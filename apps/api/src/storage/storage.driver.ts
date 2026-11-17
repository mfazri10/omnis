/**
 * Abstraksi object storage (doc 08: S3-compatible, prefix `{slug}/`).
 * Interface sengaja kecil — driver S3 menyusul tanpa mengubah pemakainya.
 */
export const STORAGE_DRIVER = Symbol("STORAGE_DRIVER");

export interface StorageDriver {
  /** Simpan buffer di `key` (format `{slug}/{nama-acak}.{ext}`). */
  put(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  /** Hapus `key`; key yang sudah tak ada dianggap sukses. */
  delete(key: string): Promise<void>;
  /** URL publik untuk `key` (S3 di produksi, endpoint lokal di dev). */
  publicUrl(key: string): string;
}
