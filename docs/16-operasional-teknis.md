# 16 — Operasional Teknis

Dokumen ini mengatur aspek operasional runtime: rate limiting, health check, monitoring, backup & restore, dan kebijakan soft delete. Referensi arsitektur di [05-arsitektur-sistem.md](05-arsitektur-sistem.md), stack di [08-tech-stack.md](08-tech-stack.md).

---

## 1. Rate Limiting

### 1.1 Strategi

Sliding window per IP, didukung Redis sebagai backing store. Implementasi menggunakan `@nestjs/throttler` dengan custom Redis storage agar state rate limit bertahan lintas restart dan konsisten antar proses (bila di-scale horizontal).

### 1.2 Limit per Endpoint

| Endpoint | Limit | Window | Keterangan |
|---|---|---|---|
| `POST /auth/sign-in` | 5 request | 1 menit | Brute-force login |
| `POST /auth/forgot-password` | 3 request | 5 menit | Penyalahgunaan reset |
| `POST /uploads` | 30 request | 1 menit | Upload media REST |
| `POST /graphql` (authenticated) | 120 request | 1 menit | Operasi CMS normal |
| `POST /graphql` (unauthenticated) | 20 request | 1 menit | Introspeksi / query publik |

### 1.3 Response saat Terkena Limit

- HTTP **429 Too Many Requests**
- Header `Retry-After: <detik>` menunjukkan kapan klien boleh mengulangi.
- Body JSON:

```json
{
  "statusCode": 429,
  "message": "Too many requests. Try again in <N> seconds.",
  "retryAfter": 42
}
```

### 1.4 Implementasi NestJS

```typescript
// throttler.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nestjs/throttler/dist/throttler-storage-redis.service';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 60_000, limit: 120 },   // default authenticated
      ],
      storage: new ThrottlerStorageRedisService(redisClient),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppThrottlerModule {}
```

Endpoint-specific limit diterapkan via decorator `@Throttle()` pada controller/resolver masing-masing:

```typescript
@Throttle({ short: { ttl: 60_000, limit: 5 } })
@Post('auth/sign-in')
signIn() { /* ... */ }

@Throttle({ short: { ttl: 300_000, limit: 3 } })
@Post('auth/forgot-password')
forgotPassword() { /* ... */ }
```

GraphQL unauthenticated vs authenticated dibedakan di custom guard yang memeriksa keberadaan sesi sebelum menentukan limit mana yang berlaku.

---

## 2. Health Check

### 2.1 Endpoint

```
GET /health
```

Public, tanpa autentikasi. Digunakan oleh load balancer, uptime monitor, dan container orchestrator.

### 2.2 Komponen yang Diperiksa

| Komponen | Check | Degraded Threshold |
|---|---|---|
| Control-plane DB | `SELECT 1` pada koneksi `platform` | > 500 ms |
| Redis | `PING` | > 200 ms |
| Object Storage | `HEAD` pada bucket utama | > 1 s |
| BullMQ Worker | `queue.isReady()` | — (boolean: ready atau tidak) |

### 2.3 Response

```json
{
  "status": "ok",
  "checks": {
    "controlPlaneDb": { "status": "ok", "responseTime": 12 },
    "redis":          { "status": "ok", "responseTime": 3 },
    "objectStorage":  { "status": "ok", "responseTime": 187 },
    "bullmqWorker":   { "status": "ok" }
  },
  "uptime": 86432,
  "version": "1.2.0"
}
```

Nilai `status` di level root:

| Status | Kondisi |
|---|---|
| `ok` | Semua komponen `ok` |
| `degraded` | Satu atau lebih komponen melebihi threshold degraded, tapi masih menjawab |
| `down` | Satu atau lebih komponen gagal total (koneksi timeout / error) |

HTTP status code:
- `200` untuk `ok` dan `degraded`
- `503` untuk `down`

### 2.4 Liveness vs Readiness (Container Orchestration)

Untuk deployment Kubernetes atau container orchestrator di fase lanjut:

| Probe | Endpoint | Perilaku |
|---|---|---|
| **Liveness** | `GET /health/live` | Selalu `200` selama proses NestJS berjalan (tidak hang). Gagal → container di-restart. |
| **Readiness** | `GET /health/ready` | `200` hanya jika status keseluruhan `ok` atau `degraded`. `503` jika `down` → container ditarik dari load balancer sampai pulih. |

Fase 1 (Docker Compose) cukup menggunakan `GET /health` sebagai health check tunggal. Probe terpisah disiapkan saat migrasi ke orchestrator.

---

## 3. Monitoring & Alerting

### 3.1 Metrik Wajib

| Metrik | Sumber | Alert Threshold |
|---|---|---|
| API response time p95 | NestJS middleware (histogram per rute) | > 1 s |
| DB connection pool usage | `DatabaseModule` connection factory | > 80% kapasitas pool |
| BullMQ failed jobs | Worker event `failed` | > 5 dalam 10 menit |
| Queue depth (waiting) | `queue.getWaitingCount()` BullMQ | > 100 job |
| Disk usage | OS-level metric | > 85% |
| Error rate (5xx) | API response middleware | > 1% dari total request (window 5 menit) |

### 3.2 Stack Monitoring

#### Fase 1 — Structured Logging

Logging terstruktur JSON dengan **pino** (sudah terintegrasi NestJS via `nestjs-pino`):

```typescript
// main.ts
import { Logger } from 'nestjs-pino';

app.useLogger(app.get(Logger));
```

Setiap log entry berisi:

```json
{
  "level": "info",
  "time": 1700000000000,
  "pid": 1,
  "msg": "POST /graphql 200 45ms",
  "req": { "method": "POST", "url": "/graphql" },
  "res": { "statusCode": 200 },
  "responseTime": 45,
  "adminId": 7,
  "appSlug": "tes-cpns"
}
```

Manajemen log Fase 1:
- **File rotation**: `pino-roll` atau logrotate OS-level, retensi 14 hari di disk.
- **Alternatif**: Grafana Loki + Promtail untuk agregasi terpusat (opsional bila resource VPS cukup).

Alert Fase 1 diimplementasikan sebagai cron job sederhana yang mem-parse log terbaru dan mengirim notifikasi (email/webhook) jika threshold terlampaui.

#### Fase Lanjut — Prometheus + Grafana

| Komponen | Peran |
|---|---|
| `prom-client` (npm) | Expose metrik dari NestJS di `GET /metrics` |
| Prometheus | Scrape metrik, simpan time-series, evaluasi alert rules |
| Alertmanager | Kirim notifikasi (email, Slack, webhook) |
| Grafana | Dashboard visualisasi, eksplorasi log (Loki datasource) |

Metrik kustom yang di-expose:

```typescript
import { Counter, Histogram } from 'prom-client';

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

const bullmqFailedTotal = new Counter({
  name: 'bullmq_failed_jobs_total',
  help: 'Total BullMQ failed jobs',
  labelNames: ['queue'],
});
```

---

## 4. Backup & Restore

### 4.1 Jadwal Backup

- **Frekuensi**: harian, pukul **02:00 WIB** (di luar jam operasional).
- **Tool**: `pg_dump` per database → kompresi `gzip` → upload ke bucket S3 terpisah (bukan bucket media).

### 4.2 Cakupan

Script backup membaca daftar database aktif dari registry control-plane:

```sql
SELECT db_name FROM apps WHERE status != 'archived';
```

Ditambah database `platform` (control-plane) yang selalu di-backup. Aplikasi baru otomatis tercakup tanpa konfigurasi manual.

### 4.3 Alur Backup

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DATE=$(date +%Y-%m-%d)
S3_BUCKET="s3://backups-platform"

# 1. Backup control-plane
pg_dump -Fc platform | gzip > "platform_${BACKUP_DATE}.dump.gz"
aws s3 cp "platform_${BACKUP_DATE}.dump.gz" "${S3_BUCKET}/daily/${BACKUP_DATE}/"

# 2. Backup semua App DB aktif
DB_LIST=$(psql -t -A platform -c \
  "SELECT db_name FROM apps WHERE status != 'archived';")

for DB in $DB_LIST; do
  pg_dump -Fc "$DB" | gzip > "${DB}_${BACKUP_DATE}.dump.gz"
  aws s3 cp "${DB}_${BACKUP_DATE}.dump.gz" "${S3_BUCKET}/daily/${BACKUP_DATE}/"
done

# 3. Bersihkan backup lokal
rm -f ./*_${BACKUP_DATE}.dump.gz
```

### 4.4 Retensi

| Tier | Retensi | Kapan |
|---|---|---|
| Harian | 7 hari terakhir | Setiap hari 02:00 WIB |
| Mingguan | 4 minggu terakhir | Backup hari Minggu dipromosikan ke folder `weekly/` |

Script retensi (cron terpisah setelah backup selesai) menghapus backup harian > 7 hari dan mingguan > 4 minggu dari bucket S3.

### 4.5 Prosedur Restore

Langkah-langkah restore satu database (contoh: `app_tes_cpns`):

| Langkah | Perintah / Aksi |
|---|---|
| 1. Identifikasi target | Tentukan nama database dan timestamp backup yang diinginkan |
| 2. Download backup | `aws s3 cp s3://backups-platform/daily/2026-11-07/app_tes_cpns_2026-11-07.dump.gz .` |
| 3. Buat DB sementara | `createdb app_tes_cpns_restore` |
| 4. Restore ke DB sementara | `gunzip -c app_tes_cpns_2026-11-07.dump.gz \| pg_restore -d app_tes_cpns_restore` |
| 5. Verifikasi data | Jalankan query pengecekan: jumlah tabel, jumlah row kritis, integritas referensi |
| 6. Rename (swap) | `ALTER DATABASE app_tes_cpns RENAME TO app_tes_cpns_old;`<br>`ALTER DATABASE app_tes_cpns_restore RENAME TO app_tes_cpns;` |
| 7. Validasi aplikasi | Tes akses CMS untuk aplikasi terkait; pastikan data tampil benar |
| 8. Drop database lama | `DROP DATABASE app_tes_cpns_old;` — setelah konfirmasi restore berhasil |

> **Catatan penting**: Langkah 6 (rename) memerlukan tidak ada koneksi aktif ke database target. Tutup koneksi dari connection factory terlebih dahulu, lalu buka kembali setelah rename selesai.

### 4.6 Isolasi Multi-DB sebagai Keuntungan

Arsitektur multi-database ([05-arsitektur-sistem.md](05-arsitektur-sistem.md)) memungkinkan restore satu App DB tanpa mengganggu database lain. Control-plane dan App DB lain tetap beroperasi normal selama proses restore. Ini menjadi keuntungan langsung dibanding arsitektur single-database multi-tenant.

### 4.7 Test Restore Bulanan

- **Jadwal**: setiap bulan, minggu pertama.
- **Prosedur**: pilih satu App DB secara acak, restore ke environment staging, verifikasi data dan fungsionalitas CMS terhadap database yang di-restore.
- **Dokumentasi**: catat tanggal, database yang di-test, hasil, dan temuan di log operasional.

---

## 5. Soft Delete Policy

Kebijakan penghapusan data per tabel, berdasarkan skema di [06-database-design.md](06-database-design.md):

### 5.1 Control-Plane DB (`platform`)

| Tabel | Strategi | Mekanisme | Alasan |
|---|---|---|---|
| `apps` | Soft delete | `deleted_at` timestamp + status `archived` | Registry harus bisa ditelusuri; App DB tetap ada untuk audit |
| `admins` | Soft delete | `is_active = false` | Audit log merujuk admin; identitas harus tetap ada |
| `roles` | Soft delete | `deleted_at` timestamp | Audit trail assignment historis |
| `permissions` | **TIDAK dihapus** | — | Di-seed dari katalog kode; versi baru menambah permission, tidak menghapus yang lama |
| `activity_logs` | Append-only, **TIDAK dihapus** | — | Kebutuhan audit; retensi ≥ 1 tahun (lihat [06-database-design.md](06-database-design.md)) |
| `notification_campaigns` | Soft delete | `deleted_at` timestamp | Riwayat kampanye untuk pelaporan |

### 5.2 App DB (`app_{slug}`)

| Tabel | Strategi | Mekanisme | Alasan |
|---|---|---|---|
| `users` | Soft delete | `deleted_at` timestamp | Data transaksi domain (soal, pesanan, dll.) merujuk user |
| `media` | **Hard delete** | Hapus record DB + hapus file dari object storage | Tidak ada referensi kritis; menghemat storage |
| `device_tokens` | **Hard delete** | Hapus record DB | Token basi dibersihkan secara periodik oleh worker notifikasi |

### 5.3 Konvensi Query

Semua query default harus menyertakan filter soft delete:

```typescript
// Drizzle: tambahkan .where(isNull(table.deletedAt)) pada query default
const activeApps = await db
  .select()
  .from(apps)
  .where(isNull(apps.deletedAt));

// Admin: filter berdasarkan is_active
const activeAdmins = await db
  .select()
  .from(admins)
  .where(eq(admins.isActive, true));
```

Resolver yang butuh data terhapus (misal: audit trail detail) harus secara eksplisit meng-override filter ini.

---

## 6. Referensi Antar Dokumen

| Topik | Dokumen | Relevansi |
|---|---|---|
| Arsitektur & deployment | [05-arsitektur-sistem.md](05-arsitektur-sistem.md) | Lingkungan Docker Compose Fase 1, alur request, keamanan |
| Tech stack | [08-tech-stack.md](08-tech-stack.md) | NestJS, PostgreSQL, Redis + BullMQ, Drizzle, S3-compatible storage |
| Skema database | [06-database-design.md](06-database-design.md) | Definisi tabel, kolom `deleted_at`, `is_active`, konvensi PK/timestamp |
| RBAC & permission | [04-user-role-permission.md](04-user-role-permission.md) | Permission seed, role assignment |
| Connection factory | [05-arsitektur-sistem.md § DatabaseModule](05-arsitektur-sistem.md) | Connection pool per App DB; metrik pool usage merujuk modul ini |
| Roadmap | [09-roadmap.md](09-roadmap.md) | Fase monitoring lanjut (Prometheus + Grafana) |
