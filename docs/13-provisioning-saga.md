# 13 — Provisioning Saga & Compensation

## 1. Masalah

Provisioning aplikasi baru memerlukan serangkaian langkah lintas batas transaksional:

1. **`CREATE DATABASE` tidak bisa di-rollback.** PostgreSQL melarang `CREATE DATABASE` di dalam blok `BEGIN … COMMIT`. Sekali database terbuat, satu-satunya cara membatalkan adalah `DROP DATABASE`.
2. **Migrasi DDL bersifat permanen.** Tabel yang sudah dibuat di App DB tidak bisa di-rollback secara parsial — harus buang seluruh database.
3. **Side effect tersebar.** Insert ke registry control-plane, pembuatan database, migrasi skema, dan insert config terjadi di database yang berbeda.

Karena tidak ada satu transaksi atomik yang bisa membungkus semua langkah, kita menerapkan **pola saga**: setiap langkah punya aksi kompensasi yang dieksekusi mundur jika langkah berikutnya gagal.

## 2. Langkah Provisioning (Saga Steps)

| Step | Aksi | Kompensasi (jika gagal di step berikutnya) |
|------|------|---------------------------------------------|
| 1 | Validasi slug unik + input | — (belum ada side effect) |
| 2 | Insert registry `apps` dengan status `provisioning` | — (registry DIPERTAHANKAN sebagai jejak; ditandai `failed` + `failure_reason`, TIDAK dihapus — retry/CMS butuh barisnya) |
| 3 | `CREATE DATABASE app_{slug}` | `DROP DATABASE app_{slug}` |
| 4 | Jalankan migrasi template (`users`, `media`, `device_tokens`) | `DROP DATABASE app_{slug}` (migrasi parsial tidak bisa di-rollback) |
| 5 | Jalankan migrasi modul domain (jika dipilih) | `DROP DATABASE app_{slug}` |
| 6 | Insert `app_configs` default | `DELETE FROM app_configs WHERE app_id = $id` |
| 7 | Update status `apps` → `active` | — (tidak perlu; status tetap `provisioning` jika belum dijalankan) |
| 8 | Tulis audit log | — (best effort; kegagalan log tidak men-trigger kompensasi) |

> Step 3–5 menggunakan kompensasi yang sama (`DROP DATABASE`) karena migrasi parsial menghasilkan skema tidak konsisten — lebih aman membuang seluruh database dan retry dari awal.

## 3. State Machine

```text
                          ┌────────────┐
     provisionApp() ───►  │provisioning│
                          └─────┬──────┘
                                │
                     ┌──────────┴──────────┐
                     │                     │
               semua step OK         gagal + kompensasi
                     │                     │
                     ▼                     ▼
               ┌──────────┐         ┌──────────┐
               │  active  │         │  failed   │
               └──────────┘         └──────────┘
                                         │
                                  admin retry / cleanup
                                         │
                                         ▼
                                   ┌──────────┐
                                   │provisioning│ (retry)
                                   └──────────┘
```

Status disimpan di kolom `apps.status`. Transisi yang valid:

| Dari | Ke | Pemicu |
|------|-----|--------|
| *(baru)* | `provisioning` | `provisionApp()` dipanggil |
| `provisioning` | `active` | Semua step berhasil |
| `provisioning` | `failed` | Gagal + kompensasi selesai |
| `failed` | `provisioning` | Admin retry provisioning |

## 4. Skema Tambahan di Registry

Kolom berikut ditambahkan ke tabel `apps` (lihat [06-database-design.md](06-database-design.md)) untuk mendukung saga:

| Kolom | Tipe | Catatan |
|-------|------|---------|
| status | enum | Tambah nilai `provisioning` dan `failed` ke enum yang sudah ada (`active`, `suspended`, `archived`). `ALTER TYPE … ADD VALUE` TIDAK bisa dalam blok transaksi — migrasi mengeksekusinya sebagai statement terpisah (satu `execute()` per statement). `down()` tak bisa menghapus nilai enum (keterbatasan Postgres) — hanya tabel/kolom yang di-drop. |
| failure_reason | text NULL | Pesan error + step terakhir yang berhasil; NULL jika status bukan `failed` |
| last_provisioning_at | timestamp NULL | Waktu provisioning terakhir dimulai |

## 5. Implementasi NestJS

### 5.1 Arsitektur Service

```text
ProvisioningService
  ├── validateInput()          ← step 1
  ├── insertRegistry()         ← step 2
  ├── createDatabase()         ← step 3
  ├── runTemplateMigrations()  ← step 4
  ├── runModuleMigrations()    ← step 5
  ├── insertDefaultConfig()    ← step 6
  ├── activateApp()            ← step 7
  ├── writeAuditLog()          ← step 8
  └── compensate()             ← jalankan kompensasi mundur
```

`ProvisioningService` berada di `PlatformModule` dan menggunakan `DatabaseModule` untuk connection factory (lihat [05-arsitektur-sistem.md](05-arsitektur-sistem.md)).

### 5.2 Compensation Stack

Setiap step yang berhasil mendaftarkan fungsi kompensasi ke stack. Jika step gagal, stack dieksekusi secara LIFO (last-in-first-out) — persis seperti saga compensation.

### 5.3 Kode Contoh

```typescript
// provisioning.service.ts

interface CompensationAction {
  step: string;
  execute: () => Promise<void>;
}

@Injectable()
export class ProvisioningService {
  constructor(
    private readonly db: DatabaseService,
    private readonly migrationRunner: MigrationRunnerService,
    private readonly auditService: AuditLogService,
  ) {}

  async provisionApp(
    input: ProvisionAppInput,
    adminId: bigint,
  ): Promise<App> {
    const compensations: CompensationAction[] = [];
    const slug = input.slug;
    const dbName = `app_${slug.replace(/-/g, '_')}`;

    // Advisory lock untuk mencegah provisioning duplikat bersamaan
    const lockId = this.hashSlugToLockId(slug);
    const lockAcquired = await this.acquireAdvisoryLock(lockId);
    if (!lockAcquired) {
      throw new ConflictException(
        `Provisioning untuk slug "${slug}" sedang berjalan`,
      );
    }

    // Timeout: AbortController (§8) — timer hanya menaikkan flag;
    // tiap step memeriksa signal sebelum mulai dan melempar
    // RequestTimeoutException yang ditangani jalur kompensasi normal.
    // TIDAK PERNAH memicu kompensasi langsung dari timer (balapan).
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVISION_TIMEOUT_MS);

    try {
      // ── Step 1: Validasi ──────────────────────────────────
      await this.validateInput(slug);

      // ── Step 2: Insert registry ───────────────────────────
      // (tanpa kompensasi hapus: baris dipertahankan, gagal → failed + alasan)
      const app = await this.insertRegistry(slug, input.name, dbName);

      // ── Step 3: Create database ───────────────────────────
      await this.createDatabase(dbName);
      compensations.push({
        step: 'database',
        execute: () => this.dropDatabase(dbName),
      });

      // ── Step 4: Migrasi template ──────────────────────────
      await this.runTemplateMigrations(dbName);
      // Kompensasi tetap DROP DATABASE (replace, bukan push baru)

      // ── Step 5: Migrasi modul domain ──────────────────────
      if (input.modules?.length) {
        await this.runModuleMigrations(dbName, input.modules);
      }

      // ── Step 6: Insert config default ─────────────────────
      const configId = await this.insertDefaultConfig(app.id);
      compensations.push({
        step: 'config',
        execute: () => this.deleteConfig(app.id),
      });

      // ── Step 7: Aktifkan ──────────────────────────────────
      await this.activateApp(app.id);
      const fresh = await this.getAppById(app.id);

      // ── Step 8: Audit log (best effort) ───────────────────
      try {
        await this.auditService.log({
          adminId,
          appId: app.id,
          action: 'provision',
          entityType: 'app',
          entityId: String(app.id),
          summary: `Provisioning aplikasi "${input.name}" (${slug}) berhasil`,
        });
      } catch {
        // Best effort — tidak men-trigger kompensasi
      }

      return fresh;
    } catch (error) {
      await this.handleFailure(compensations, slug, dbName, error);
      throw error;
    } finally {
      clearTimeout(timeout);
      await this.releaseAdvisoryLock(lockId);
    }
  }

  // ── Kompensasi ──────────────────────────────────────────

  private async handleFailure(
    compensations: CompensationAction[],
    slug: string,
    dbName: string,
    originalError: unknown,
  ): Promise<void> {
    // Jalankan kompensasi LIFO
    const failedCompensations: string[] = [];

    for (const action of compensations.reverse()) {
      try {
        await action.execute();
      } catch (compError) {
        failedCompensations.push(
          `${action.step}: ${compError instanceof Error ? compError.message : String(compError)}`,
        );
      }
    }

    // Update status ke failed dengan alasan
    const reason = [
      `Error: ${originalError instanceof Error ? originalError.message : String(originalError)}`,
      ...(failedCompensations.length
        ? [`Kompensasi gagal: ${failedCompensations.join('; ')}`]
        : []),
    ].join('\n');

    await this.db.platform
      .update(apps)
      .set({
        status: 'failed',
        failureReason: reason,
      })
      .where(eq(apps.slug, slug))
      .catch(() => {
        // Jika update status juga gagal, log ke stderr
        // agar operator bisa investigasi manual
        console.error(
          `CRITICAL: gagal update status failed untuk slug=${slug}: ${reason}`,
        );
      });
  }

  // ── Langkah-langkah individual ──────────────────────────

  private async validateInput(slug: string, modules?: string[]): Promise<void> {
    // Format slug diketatkan KARENA dbName diturunkan darinya untuk SQL DDL.
    if (!/^[a-z0-9]([a-z0-9-]{1,62}[a-z0-9])?$/.test(slug)) {
      throw new BadRequestException(
        `Slug "${slug}" tidak valid (huruf kecil/angka/strip, 3–64 karakter)`,
      );
    }
    const existing = await this.db.platform
      .select()
      .from(apps)
      .where(eq(apps.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(`Slug "${slug}" sudah terdaftar`);
    }

    // Fase 1 belum punya modul domain; migrasinya no-op (Fase 2 mengisi).
    if (modules && modules.length > 0) {
      throw new BadRequestException(
        `Modul domain (${modules.join(", ")}) tersedia mulai Fase 2`,
      );
    }
  }

  private async insertRegistry(
    slug: string,
    name: string,
    dbName: string,
  ): Promise<App> {
    const [app] = await this.db.platform
      .insert(apps)
      .values({
        slug,
        name,
        dbName,
        status: 'provisioning',
        lastProvisioningAt: new Date(),
      })
      .returning();
    return app;
  }

  private async getAppById(appId: bigint): Promise<App> {
    const [app] = await this.db.platform
      .select()
      .from(apps)
      .where(eq(apps.id, appId))
      .limit(1);
    if (!app) {
      throw new NotFoundException(`Aplikasi id=${appId} tidak ditemukan`);
    }
    return app;
  }

  private async createDatabase(dbName: string): Promise<void> {
    // CREATE DATABASE tidak bisa dalam transaksi;
    // gunakan koneksi langsung tanpa BEGIN
    await this.db.adminConnection.execute(
      sql.raw(`CREATE DATABASE "${dbName}"`),
    );
  }

  private async dropDatabase(dbName: string): Promise<void> {
    // Tutup semua koneksi ke DB target sebelum DROP
    await this.db.adminConnection.execute(
      sql.raw(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}'`,
      ),
    );
    await this.db.adminConnection.execute(
      sql.raw(`DROP DATABASE IF EXISTS "${dbName}"`),
    );
  }

  private async runTemplateMigrations(dbName: string): Promise<void> {
    const connection = await this.db.connectTo(dbName);
    await this.migrationRunner.runTemplate(connection);
  }

  private async runModuleMigrations(
    dbName: string,
    modules: string[],
  ): Promise<void> {
    const connection = await this.db.connectTo(dbName);
    for (const mod of modules) {
      await this.migrationRunner.runModule(connection, mod);
    }
  }

  private async insertDefaultConfig(appId: bigint): Promise<void> {
    await this.db.platform.insert(appConfigs).values({
      appId,
      maintenanceMode: false,
      minVersionAndroid: '1.0.0',
      minVersionIos: '1.0.0',
      themePrimaryColor: '#1976D2',
    });
  }

  private async deleteConfig(appId: bigint): Promise<void> {
    await this.db.platform
      .delete(appConfigs)
      .where(eq(appConfigs.appId, appId));
  }

  private async activateApp(appId: bigint): Promise<void> {
    await this.db.platform
      .update(apps)
      .set({ status: 'active' })
      .where(eq(apps.id, appId));
  }

  // ── Advisory Lock ───────────────────────────────────────

  private hashSlugToLockId(slug: string): number {
    // Hash slug ke integer 32-bit untuk pg_advisory_lock
    let hash = 0;
    for (const ch of slug) {
      hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    }
    return Math.abs(hash);
  }

  private async acquireAdvisoryLock(lockId: number): Promise<boolean> {
    const [result] = await this.db.platform.execute(
      sql.raw(`SELECT pg_try_advisory_lock(${lockId}) AS acquired`),
    );
    return result.acquired === true;
  }

  private async releaseAdvisoryLock(lockId: number): Promise<void> {
    await this.db.platform.execute(
      sql.raw(`SELECT pg_advisory_unlock(${lockId})`),
    );
  }
}
```

## 6. Sequence Diagram

```text
Admin           ProvisioningService       Control-Plane DB      PostgreSQL (admin)      App DB
  │                     │                       │                      │                   │
  │  provisionApp()     │                       │                      │                   │
  ├────────────────────►│                       │                      │                   │
  │                     │  pg_try_advisory_lock │                      │                   │
  │                     ├──────────────────────►│                      │                   │
  │                     │◄─ acquired ───────────┤                      │                   │
  │                     │                       │                      │                   │
  │                     │  SELECT slug EXISTS?  │                      │                   │
  │                     ├──────────────────────►│                      │                   │
  │                     │◄─ no ─────────────────┤                      │                   │
  │                     │                       │                      │                   │
  │                     │  INSERT apps(status=  │                      │                   │
  │                     │   provisioning)       │                      │                   │
  │                     ├──────────────────────►│  ← push kompensasi   │                   │
  │                     │◄─ app row ────────────┤    deleteRegistry()  │                   │
  │                     │                       │                      │                   │
  │                     │  CREATE DATABASE      │                      │                   │
  │                     ├─────────────────────────────────────────────►│                   │
  │                     │◄─ OK ───────────────────────────────────────┤  ← push dropDB()  │
  │                     │                       │                      │                   │
  │                     │  migrasi template     │                      │                   │
  │                     ├──────────────────────────────────────────────────────────────────►│
  │                     │◄─ OK ────────────────────────────────────────────────────────────┤
  │                     │                       │                      │                   │
  │                     │  migrasi modul        │                      │                   │
  │                     ├──────────────────────────────────────────────────────────────────►│
  │                     │◄─ OK ────────────────────────────────────────────────────────────┤
  │                     │                       │                      │                   │
  │                     │  INSERT app_configs   │                      │                   │
  │                     ├──────────────────────►│  ← push              │                   │
  │                     │◄─ OK ─────────────────┤    deleteConfig()    │                   │
  │                     │                       │                      │                   │
  │                     │  UPDATE apps status=  │                      │                   │
  │                     │   active              │                      │                   │
  │                     ├──────────────────────►│                      │                   │
  │                     │◄─ OK ─────────────────┤                      │                   │
  │                     │                       │                      │                   │
  │                     │  INSERT activity_logs │                      │                   │
  │                     ├──────────────────────►│ (best effort)        │                   │
  │                     │                       │                      │                   │
  │                     │  pg_advisory_unlock   │                      │                   │
  │                     ├──────────────────────►│                      │                   │
  │◄── app (active) ────┤                       │                      │                   │
  │                     │                       │                      │                   │
```

**Skenario gagal** (contoh: step 5 gagal):

```text
  │                     │  migrasi modul GAGAL  │                      │                   │
  │                     │◄─ ERROR ─────────────────────────────────────────────────────────┤
  │                     │                       │                      │                   │
  │                     │  ══ KOMPENSASI (LIFO) ══                     │                   │
  │                     │  (registry TIDAK dihapus — dipertahankan      │                   │
  │                     │   sebagai baris failed + alasan)              │                   │
  │                     │                       │                      │                   │
  │                     │  DELETE app_configs?  (belum ada, skip)      │                   │
  │                     │                       │                      │                   │
  │                     │  DROP DATABASE        │                      │                   │
  │                     ├─────────────────────────────────────────────►│                   │
  │                     │◄─ OK ───────────────────────────────────────┤                   │
  │                     │                       │                      │                   │
  │                     │  UPDATE apps status=  │                      │                   │
  │                     │   failed + reason     │                      │                   │
  │                     ├──────────────────────►│                      │                   │
  │                     │                       │                      │                   │
  │◄── error ───────────┤                       │                      │                   │
```

## 7. Idempotency & Recovery Manual

### 7.1 Skenario Kompensasi Gagal

Jika kompensasi ikut gagal (contoh: `DROP DATABASE` gagal karena koneksi aktif tidak bisa di-terminate), maka:

1. Status `apps` di-update ke `failed`.
2. Kolom `failure_reason` mencatat error asli **dan** error kompensasi.
3. Database "yatim" (`app_{slug}`) mungkin masih ada di PostgreSQL.

### 7.2 Prosedur Recovery Manual

```text
1. Admin melihat daftar aplikasi dengan status "failed" di CMS
2. Periksa failure_reason untuk memahami titik kegagalan
3. Pilih tindakan:
   a. Retry  → provisionApp() akan:
      - Cek apakah DB sudah ada → DROP dulu jika ada
      - Hapus registry lama jika masih status failed
      - Mulai ulang dari step 1
   b. Cleanup manual →
      - DROP DATABASE app_{slug} via psql
      - DELETE FROM apps WHERE slug = '{slug}'
      - DELETE FROM app_configs WHERE app_id = {id}
```

### 7.3 Retry Otomatis

Retry provisioning bisa dilakukan via mutation GraphQL `retryProvisionApp(slug)`:

```typescript
async retryProvisionApp(slug: string, adminId: bigint): Promise<App> {
  const existing = await this.db.platform
    .select()
    .from(apps)
    .where(and(eq(apps.slug, slug), eq(apps.status, 'failed')))
    .limit(1);

  if (!existing.length) {
    throw new NotFoundException(
      `Tidak ada aplikasi gagal dengan slug "${slug}"`,
    );
  }

  // Bersihkan sisa provisioning sebelumnya TANPA menghapus baris
  // registry (riwayat failed dipertahankan; retry menimpa statusnya).
  const dbName = existing[0].dbName;
  await this.dropDatabaseIfExists(dbName);
  await this.deleteConfig(existing[0].id);
  await this.markProvisioning(existing[0].id);

  // Lanjutkan step 3–7 dengan baris yang sama (provisionApp inti
  // di-refactor agar bisa dipakai ulang dengan appId eksplisit).
  return this.runSteps(existing[0].id, slug, dbName, adminId);
}

private async dropDatabaseIfExists(dbName: string): Promise<void> {
  const [exists] = await this.db.adminConnection.execute(
    sql.raw(
      `SELECT 1 FROM pg_database WHERE datname = '${dbName}'`,
    ),
  );
  if (exists) {
    await this.dropDatabase(dbName);
  }
}
```

## 8. Timeout

| Parameter | Nilai Default | Keterangan |
|-----------|--------------|------------|
| `PROVISION_TIMEOUT_MS` | `30000` (30 detik) | Batas waktu total provisioning |

Mekanisme:

1. Timer dimulai saat `provisionApp()` dipanggil.
2. Jika timeout tercapai sebelum step 7 selesai, `AbortController` membatalkan operasi yang sedang berjalan.
3. Kompensasi dieksekusi seperti biasa.
4. Status di-update ke `failed` dengan `failure_reason: "Provisioning timeout after 30s"`.

```typescript
async provisionApp(input: ProvisionAppInput, adminId: bigint): Promise<App> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVISION_TIMEOUT_MS);

  try {
    // Setiap step memeriksa controller.signal.aborted
    // sebelum memulai operasi berikutnya
    if (controller.signal.aborted) {
      throw new RequestTimeoutException('Provisioning timeout');
    }
    // ... step-step provisioning ...
  } finally {
    clearTimeout(timer);
  }
}
```

## 9. Concurrency — Advisory Lock

### 9.1 Masalah

Dua admin bisa saja memanggil `provisionApp` dengan slug yang sama secara bersamaan. Tanpa perlindungan:

- Kedua proses lolos validasi slug unik (race condition).
- Satu `CREATE DATABASE` berhasil, satu gagal, tapi registry sudah ter-insert dua kali.

### 9.2 Solusi: PostgreSQL Advisory Lock

```sql
-- Akuisisi (non-blocking, return boolean)
SELECT pg_try_advisory_lock(hashtext('provision:tes-cpns')) AS acquired;

-- Lepas setelah selesai
SELECT pg_advisory_unlock(hashtext('provision:tes-cpns'));
```

Perilaku:

| Skenario | Hasil |
|----------|-------|
| Admin A mulai provisioning `tes-cpns` | Lock acquired → proses berjalan |
| Admin B memanggil provisioning `tes-cpns` saat A masih berjalan | Lock gagal → tolak langsung dengan `ConflictException` |
| Admin A selesai (sukses atau gagal + kompensasi) | Lock dilepas di `finally` |
| Admin B retry setelah A selesai | Lock acquired → proses berjalan |

Advisory lock dipilih karena:

- **Session-level**, otomatis lepas jika koneksi putus (tidak ada deadlock permanen).
- **Tidak memblok** operasi lain di tabel `apps`.
- **Ringan** — tidak perlu tabel lock tambahan.

> WAJIB: lock diakuisisi dan dilepas pada SATU koneksi khusus yang
> dipegang selama saga berjalan (`pool.connect()` + `release()` di
> `finally`, pola `withMigrationConnection`). Akuisisi/lepas via pool
> bersama BERBAHAYA karena tiap query bisa memakai koneksi berbeda
> sehingga lock bocor. Kunci lock: `hashtext('provision:' || slug)`
> (server-side, §9.2 — bukan hash JS).

## 10. Ringkasan Keputusan

| Aspek | Keputusan | Alasan |
|-------|-----------|--------|
| Pola | Saga + compensation stack | `CREATE DATABASE` tidak transaksional |
| Registry saat gagal | Dipertahankan `failed` + alasan (tidak dihapus) | Retry/CMS butuh barisnya; DB yatim yang dibuang |
| Kompensasi migrasi | DROP seluruh database | Migrasi parsial tidak bisa di-rollback per tabel |
| Gagal + kompensasi gagal | Status `failed` + `failure_reason` | Admin bisa diagnosa dan retry/cleanup |
| Timeout | 30 detik default | Mencegah provisioning menggantung |
| Concurrency | `pg_try_advisory_lock` per slug | Ringan, session-level, anti-deadlock |
| Audit log | Best effort (step terakhir) | Kegagalan log tidak boleh membatalkan provisioning yang sudah berhasil |
| Retry | Bersihkan sisa → provisioning ulang | Idempoten; DB yatim di-drop sebelum retry |

## 11. Referensi

- [05-arsitektur-sistem.md](05-arsitektur-sistem.md) — Alur provisioning aplikasi baru (§4.2)
- [06-database-design.md](06-database-design.md) — Skema tabel `apps`, `app_configs`, dan template App DB
- [12-migration-strategy.md](12-migration-strategy.md) — Strategi migrasi database per App DB
