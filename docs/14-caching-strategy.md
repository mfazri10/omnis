# 14 — Strategi Caching

## 1. Masalah

Setiap request app-scoped melewati rangkaian pengecekan sebelum resolver berjalan (lihat [05-arsitektur-sistem.md](05-arsitektur-sistem.md) § 4.1):

```text
CMS → GraphQL + cookie sesi + X-App-Slug
  1. Sesi valid?                → query session (better-auth)
  2. Admin aktif?               → query admins (control-plane DB)
  3. Slug valid & tidak suspended? → query apps (control-plane DB)
  4. Permission cukup?          → query admin_role_assignments + role_permissions (control-plane DB)
  → resolver jalan
```

Tanpa cache, setiap request menghasilkan **3–4 query ke control-plane DB** hanya untuk otorisasi — sebelum query domain apa pun dijalankan. Pada beban normal pun ini membuang latency dan koneksi DB yang tidak perlu, karena data otorisasi jarang berubah antar-request.

## 2. Layer Caching

Semua key Redis memakai prefix `cms:` (lihat bagian 7).

| # | Layer | Data | Storage | TTL | Invalidasi |
|---|---|---|---|---|---|
| 1 | Session | Sesi better-auth | better-auth built-in (DB-backed) | Diatur better-auth (default session expiry) | `logout`, nonaktifkan admin |
| 2 | Admin profile + status | Baris `admins` (`id`, `name`, `is_active`, `is_super_admin`) | Redis hash `cms:admin:{id}` | 60 detik | `setAdminActive`, `updateAdmin` |
| 3 | Permission set | Resolved permissions per admin per app (gabungan semua role yang dipegang admin di app tersebut) | Redis set `cms:perms:{admin_id}:{app_id}` | 5 menit | `assignRole`, `unassignRole`, `updateRole`, `deleteRole` |
| 4 | App registry | Baris `apps` (slug → id, `status`, `db_name`) | Redis hash `cms:app:{slug}` | 5 menit | `updateApp`, `suspendApp` |
| 5 | App config | Baris `app_configs` (`maintenance_mode`, versi minimum, tema, dll.) | Redis hash `cms:appconfig:{slug}` | 5 menit | `updateAppConfig` |

### Catatan per layer

- **Session (1)**: dikelola sepenuhnya oleh better-auth — tidak ada cache custom. Logout atau penonaktifan admin memicu pencabutan sesi melalui API better-auth.
- **Admin (2)**: TTL pendek (60 detik) agar perubahan status `is_active` terasa hampir instan meski tanpa invalidasi eksplisit. Invalidasi eksplisit tetap dilakukan agar kasus terburuk bukan 60 detik.
- **Permission (3)**: paling mahal dihitung (JOIN `admin_role_assignments` → `role_permissions` → `permissions`). TTL 5 menit aman karena invalidasi eksplisit menghapus key saat role berubah.
- **App registry (4) dan config (5)**: berubah sangat jarang; TTL 5 menit sebagai jaring pengaman.

## 3. Pola Invalidasi

Invalidasi berbasis **event** menggunakan NestJS `EventEmitter2`. Setiap mutation yang mengubah data ter-cache **wajib** emit event yang menghapus key terkait.

```text
Mutation                    → Event                          → Key dihapus
────────────────────────────────────────────────────────────────────────────
setAdminActive(id)          → admin.updated {adminId}        → cms:admin:{id}
updateAdmin(id)             → admin.updated {adminId}        → cms:admin:{id}

assignRole(adminId, roleId, appId)
                            → role-assignment.changed        → cms:perms:{adminId}:{appId}
                              {adminId, appId}
unassignRole(adminId, roleId, appId)
                            → role-assignment.changed        → cms:perms:{adminId}:{appId}
                              {adminId, appId}

updateRole(roleId)          → role.updated {roleId}          → semua cms:perms:*
                                                                yang memuat role ini ¹
deleteRole(roleId)          → role.deleted {roleId}          → semua cms:perms:*
                                                                yang memuat role ini ¹

updateApp(slug)             → app.updated {slug}             → cms:app:{slug}
suspendApp(slug)            → app.updated {slug}             → cms:app:{slug}

updateAppConfig(slug)       → app-config.updated {slug}      → cms:appconfig:{slug}
```

¹ Untuk `updateRole` dan `deleteRole`, handler melakukan lookup `admin_role_assignments` untuk role tersebut, lalu menghapus `cms:perms:{adminId}:{appId}` untuk setiap assignment yang ditemukan. Jumlah admin per role kecil, jadi ini murah.

### Contoh implementasi event handler

```typescript
@Injectable()
export class CacheInvalidationListener {
  constructor(private readonly redis: Redis) {}

  @OnEvent('admin.updated')
  async onAdminUpdated(payload: { adminId: number }) {
    await this.redis.del(`cms:admin:${payload.adminId}`);
  }

  @OnEvent('role-assignment.changed')
  async onRoleAssignmentChanged(payload: { adminId: number; appId: number }) {
    await this.redis.del(`cms:perms:${payload.adminId}:${payload.appId}`);
  }

  @OnEvent('role.updated')
  @OnEvent('role.deleted')
  async onRoleChanged(payload: { roleId: number }) {
    // Cari semua admin yang memegang role ini, hapus cache permission mereka
    const assignments = await this.db
      .select()
      .from(adminRoleAssignments)
      .where(eq(adminRoleAssignments.roleId, payload.roleId));

    const keys = assignments.map(
      (a) => `cms:perms:${a.adminId}:${a.appId}`,
    );
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  @OnEvent('app.updated')
  async onAppUpdated(payload: { slug: string }) {
    await this.redis.del(`cms:app:${payload.slug}`);
  }

  @OnEvent('app-config.updated')
  async onAppConfigUpdated(payload: { slug: string }) {
    await this.redis.del(`cms:appconfig:${payload.slug}`);
  }
}
```

### Contoh emit dari mutation

```typescript
@Mutation(() => Admin)
async setAdminActive(
  @Args('id') id: number,
  @Args('isActive') isActive: boolean,
) {
  const admin = await this.adminService.setActive(id, isActive);

  if (!isActive) {
    // Nonaktifkan → cabut semua sesi via better-auth
    await this.authService.revokeSessionsByUserId(admin.authUserId);
  }

  this.eventEmitter.emit('admin.updated', { adminId: id });
  return admin;
}
```

## 4. Guard Flow dengan Cache

Pseudo-code alur guard pada setiap request app-scoped:

```text
function appScopedGuard(request):
    // 1. Sesi → better-auth (built-in, tidak ada cache custom)
    session = betterAuth.verifySession(request.cookie)
    if !session → 401 UNAUTHENTICATED

    adminId = lookupAdminId(session.userId)

    // 2. Admin aktif? → Redis || DB fallback → cache
    admin = redis.hgetall("cms:admin:{adminId}")
    if miss:
        admin = db.query(admins).where(id = adminId)
        if !admin → 401 UNAUTHENTICATED
        redis.hset("cms:admin:{adminId}", admin)
        redis.expire("cms:admin:{adminId}", 60)

    if !admin.is_active → 403 FORBIDDEN

    // 3. Super Admin shortcut
    if admin.is_super_admin:
        appSlug = request.header["X-App-Slug"]
        app = redis.hgetall("cms:app:{appSlug}")
        if miss:
            app = db.query(apps).where(slug = appSlug)
            if !app → 400 INVALID_APP
            redis.hset("cms:app:{appSlug}", app)
            redis.expire("cms:app:{appSlug}", 300)
        if app.status == "suspended" → 403 APP_SUSPENDED
        // Super Admin: skip permission check
        request.appDbName = app.db_name
        → lanjut resolver

    // 4. App valid? → Redis || DB fallback → cache
    appSlug = request.header["X-App-Slug"]
    app = redis.hgetall("cms:app:{appSlug}")
    if miss:
        app = db.query(apps).where(slug = appSlug)
        if !app → 400 INVALID_APP
        redis.hset("cms:app:{appSlug}", app)
        redis.expire("cms:app:{appSlug}", 300)

    if app.status == "suspended" → 403 APP_SUSPENDED

    // 5. Permission? → Redis || resolve dari DB → cache
    requiredPerm = getRequiredPermission(resolver)    // dari decorator
    permsKey = "cms:perms:{adminId}:{app.id}"
    cachedPerms = redis.smembers(permsKey)
    if miss:
        cachedPerms = resolvePermissions(adminId, app.id)
        // JOIN admin_role_assignments → role_permissions → permissions
        // WHERE admin_id = adminId AND app_id = app.id
        // + role global (app_id IS NULL)
        redis.sadd(permsKey, ...cachedPerms)
        redis.expire(permsKey, 300)

    if requiredPerm NOT IN cachedPerms → 403 FORBIDDEN

    // 6. Semua OK → lanjut resolver
    request.appDbName = app.db_name
    → lanjut resolver
```

Hasil terbaik (semua cache hit): **0 query ke control-plane DB** untuk otorisasi.
Hasil terburuk (semua cache miss): 3 query (admin + app + permissions) — sama seperti tanpa cache, lalu di-cache untuk request berikutnya.

## 5. Super Admin Shortcut

Super Admin melewati pengecekan permission setelah `is_super_admin` dikonfirmasi dari cache/DB (lihat langkah 3 pada guard flow di atas). Validasi app tetap dilakukan (slug harus valid, app tidak suspended) karena Super Admin tetap perlu konteks App DB yang benar.

Ini sesuai dengan aturan di [04-user-role-permission.md](04-user-role-permission.md) § 5: guard memeriksa admin aktif + (Super Admin **atau** punya permission dalam cakupan aplikasi konteks).

## 6. Cache Warming

**Tidak diperlukan.** Lazy populate (isi cache saat pertama kali diakses) cukup karena:

- Jumlah admin kecil (puluhan, bukan ribuan).
- Setelah login, request pertama mengisi cache; request selanjutnya memakai cache.
- Tidak ada lonjakan cold-start yang berarti — admin login tersebar sepanjang hari, bukan serentak.

## 7. Redis Key Namespace

Semua key Redis untuk caching memakai prefix `cms:` agar tidak bertabrakan dengan key BullMQ atau key lain di instance Redis yang sama.

| Key | Tipe Redis | Contoh | Isi |
|---|---|---|---|
| `cms:admin:{id}` | Hash | `cms:admin:42` | `name`, `is_active`, `is_super_admin`, `auth_user_id` |
| `cms:perms:{admin_id}:{app_id}` | Set | `cms:perms:42:3` | Daftar permission key: `cbt.questions.create`, `cbt.questions.view`, … |
| `cms:app:{slug}` | Hash | `cms:app:tes-cpns` | `id`, `slug`, `status`, `db_name` |
| `cms:appconfig:{slug}` | Hash | `cms:appconfig:tes-cpns` | `maintenance_mode`, `min_version_android`, `theme_primary_color`, … |

## 8. Fallback: Redis Down

Jika Redis tidak tersedia (koneksi gagal / timeout), **semua query langsung ke control-plane DB**. Ini menghasilkan degraded performance (latency lebih tinggi, beban DB lebih besar) tetapi **bukan outage** — sistem tetap berfungsi penuh.

Implementasi: wrapper Redis yang menangkap exception koneksi dan mengembalikan cache miss, sehingga kode guard selalu jatuh ke jalur DB fallback.

```typescript
@Injectable()
export class ResilientCacheService {
  constructor(private readonly redis: Redis) {}

  async hgetall(key: string): Promise<Record<string, string> | null> {
    try {
      const result = await this.redis.hgetall(key);
      return Object.keys(result).length > 0 ? result : null;
    } catch {
      // Redis down → return cache miss, fallback ke DB
      return null;
    }
  }

  async smembers(key: string): Promise<string[] | null> {
    try {
      const result = await this.redis.smembers(key);
      return result.length > 0 ? result : null;
    } catch {
      return null;
    }
  }

  async setHash(key: string, data: Record<string, string>, ttl: number): Promise<void> {
    try {
      await this.redis.hset(key, data);
      await this.redis.expire(key, ttl);
    } catch {
      // Redis down → skip caching, tidak fatal
    }
  }

  async setSet(key: string, members: string[], ttl: number): Promise<void> {
    try {
      await this.redis.sadd(key, ...members);
      await this.redis.expire(key, ttl);
    } catch {
      // Redis down → skip caching, tidak fatal
    }
  }

  async del(...keys: string[]): Promise<void> {
    try {
      await this.redis.del(...keys);
    } catch {
      // Redis down → key akan expire sendiri via TTL
    }
  }
}
```

## 9. Monitoring

Pantau **cache hit/miss ratio per layer** untuk mendeteksi masalah invalidasi berlebihan atau TTL terlalu pendek.

| Metrik | Cara ukur | Tindakan |
|---|---|---|
| `cms.cache.hit{layer=admin}` | Counter di `ResilientCacheService` saat Redis mengembalikan data | Hit rate < 80% → periksa apakah TTL terlalu pendek atau invalidasi terlalu agresif |
| `cms.cache.miss{layer=admin}` | Counter saat Redis mengembalikan null/kosong | — |
| `cms.cache.hit{layer=perms}` | Counter untuk layer permission | Hit rate < 70% → kemungkinan role sering berubah atau banyak kombinasi admin×app unik |
| `cms.cache.miss{layer=perms}` | Counter | — |
| `cms.cache.hit{layer=app}` | Counter untuk layer app registry | Hit rate harus > 95% (data jarang berubah) |
| `cms.cache.miss{layer=app}` | Counter | — |
| `cms.cache.hit{layer=appconfig}` | Counter untuk layer app config | — |
| `cms.cache.miss{layer=appconfig}` | Counter | — |
| `cms.cache.error` | Counter saat Redis throw exception | > 0 berkelanjutan → periksa koneksi Redis |

Contoh instrumentasi:

```typescript
async hgetall(key: string): Promise<Record<string, string> | null> {
  const layer = this.extractLayer(key); // "admin" | "perms" | "app" | "appconfig"
  try {
    const result = await this.redis.hgetall(key);
    if (Object.keys(result).length > 0) {
      this.metrics.increment(`cms.cache.hit`, { layer });
      return result;
    }
    this.metrics.increment(`cms.cache.miss`, { layer });
    return null;
  } catch {
    this.metrics.increment(`cms.cache.error`);
    return null;
  }
}

private extractLayer(key: string): string {
  // "cms:admin:42" → "admin"
  // "cms:perms:42:3" → "perms"
  // "cms:app:slug" → "app"
  // "cms:appconfig:slug" → "appconfig"
  const parts = key.split(':');
  return parts[1];
}
```

## 10. Ringkasan Dampak

| Kondisi | Query control-plane per request | Latency otorisasi |
|---|---|---|
| Tanpa cache | 3–4 query | Tinggi |
| Cache hit penuh | 0 query (Redis saja) | ~1–2 ms |
| Cache miss (pertama kali / setelah invalidasi) | 3 query, lalu di-cache | Sama seperti tanpa cache, hanya sekali |
| Redis down | 3–4 query (fallback) | Sama seperti tanpa cache, terus-menerus |

## 11. Referensi

- [04-user-role-permission.md](04-user-role-permission.md) — RBAC dinamis: role, permission, penegakan, Super Admin
- [05-arsitektur-sistem.md](05-arsitektur-sistem.md) — Arsitektur sistem: alur request app-scoped, modul NestJS
- [06-database-design.md](06-database-design.md) — Skema tabel `admins`, `roles`, `admin_role_assignments`, `apps`, `app_configs`
- [08-tech-stack.md](08-tech-stack.md) — Redis + BullMQ sebagai stack terkunci
