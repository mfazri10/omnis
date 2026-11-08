# Pattern Backend — NestJS + GraphQL + Drizzle (Multi-Database)

Acuan: [05-arsitektur](../docs/05-arsitektur-sistem.md), [06-database](../docs/06-database-design.md), [07-api](../docs/07-api-design.md), [11-pooling](../docs/11-connection-pooling.md), [12-migrasi](../docs/12-migration-strategy.md), [14-caching](../docs/14-caching-strategy.md), [15-testing](../docs/15-testing-strategy.md).

## 1. Struktur Direktori

```text
apps/api/src/
├── main.ts                    # Bootstrap: ValidationPipe global, filter error, CORS
├── app.module.ts              # Import DatabaseModule, AuthModule, modul fitur
├── common/
│   ├── decorators/            # CurrentAdmin, CurrentApp, AppDb, ControlDb,
│   │                          # RequirePermissions, RequireApp
│   ├── guards/                # AuthGuard, AppContextGuard, PermissionGuard
│   ├── filters/               # GraphQL exception filter → extensions.code
│   ├── interceptors/          # AppDatabaseInterceptor
│   ├── scalars/               # Custom scalars bila perlu (JSON, Date)
│   └── types/                 # PaginationArgs, PaginatedType, AppRequestContext
├── config/                    # app, database, auth, storage, fcm (env tervalidasi)
├── database/                  # DatabaseModule (@Global) + DatabaseService (doc 11)
├── cache/                     # ResilientCacheService + listener invalidasi (doc 14)
├── auth/                      # Instance better-auth + controller mount /api/auth/*
├── audit/                     # AuditLogService (helper tulis log)
└── modules/
    ├── platform/              # Control-plane: apps, provisioning, config,
    │   │                      # admins, roles, audit-log, dashboard
    │   ├── apps/
    │   │   ├── apps.module.ts, apps.resolver.ts, apps.service.ts,
    │   │   ├── apps.repository.ts, dto/, types/
    │   ├── roles/ ...         # Satu subfolder per area, pola sama
    │   └── entities/          # TABEL Drizzle control-plane (*.entity.ts)
    ├── shared/                # Template App DB: users, media, device_tokens
    │   └── entities/          # Tabel Drizzle template
    ├── media/                 # Metadata media (App DB) + controller POST /uploads
    ├── notification/          # Kampanye (control-plane) + worker BullMQ
    ├── cbt/                   # CONTOH modul domain (Fase 2) — pola baku:
    │   ├── cbt.module.ts
    │   ├── questions/
    │   │   ├── questions.resolver.ts   # Terima request → teruskan service
    │   │   ├── questions.service.ts    # Aturan bisnis, tanpa query langsung
    │   │   ├── questions.repository.ts # SATU-SATUNYA tempat query Drizzle
    │   │   ├── dto/                    # *.input.ts (class-validator)
    │   │   └── types/                  # *.type.ts (@ObjectType GraphQL)
    │   ├── packages/ ...
    │   ├── entities/                   # Tabel Drizzle modul (glob drizzle-kit)
    │   └── cbt.permissions.ts          # Katalog permission modul (cbt.*)
    ├── pos/ ...               # Pola sama seperti cbt/
    └── debat/ ...             # Pola sama seperti cbt/
```

**Aturan pokok:**

- Satu modul = satu area platform atau satu domain aplikasi.
- Alur wajib: Resolver → Service → Repository. Tidak ada query Drizzle di service/resolver.
- Tabel Drizzle di `entities/*.entity.ts` (glob drizzle-kit doc 12); tipe GraphQL di `types/*.type.ts` — jangan campur.
- Tidak ada import silang antar modul fitur kecuali lewat exports modulnya.

## 2. Aturan Multi-Database (paling penting)

1. **Koneksi tidak pernah dipilih oleh input mentah.** Resolver/service menerima koneksi dari decorator konteks yang sudah divalidasi guard.
2. **Repository stateless: setiap method menerima instance Drizzle sebagai argumen pertama.**

```typescript
// questions.repository.ts — pola baku repository app-scoped
import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { questions } from '../entities/questions.entity';

type Db = NodePgDatabase;

@Injectable()
export class QuestionsRepository {
  findMany(db: Db, args: { category?: string; skip: number; take: number }) {
    // ... query via db yang diberikan, bukan koneksi milik sendiri
  }
}
```

```typescript
// questions.resolver.ts — koneksi datang dari konteks request
@Resolver(() => QuestionType)
@UseGuards(AuthGuard, AppContextGuard, PermissionGuard)
@RequireApp()
export class QuestionsResolver {
  constructor(private readonly questionsService: QuestionsService) {}

  @Query(() => PaginatedQuestions)
  @RequirePermissions('cbt.questions.view')
  listQuestions(@AppDb() db: Db, @Args() args: PaginationArgs) {
    return this.questionsService.list(db, args);
  }
}
```

3. Operasi control-plane memakai `@ControlDb()` (koneksi tetap, doc 11).
4. **Tidak ada query lintas App DB** dari repository domain. Pengecualian yang diizinkan hanya di tempat yang didokumentasikan: worker notifikasi membaca token App DB target (doc 05 §4.4).
5. Test memakai pola yang sama: oper `db` test ke repository (doc 15) — tanpa pola ini, test multi-DB tidak bisa diisolasi.

## 3. Guard, Decorator & Permission

Urutan guard: `AuthGuard` → `AppContextGuard` (bila `@RequireApp()`) → `PermissionGuard`.

| Guard | Tugas | Gagal → |
|---|---|---|
| `AuthGuard` | Verifikasi sesi better-auth dari cookie; tolak profil nonaktif | `UNAUTHENTICATED` |
| `AppContextGuard` | Validasi `X-App-Slug` (cache doc 14): ada, `active`, admin berhak | `APP_NOT_FOUND` / `APP_SUSPENDED` / `FORBIDDEN` |
| `PermissionGuard` | Baca `@RequirePermissions(...)`; Super Admin lewat; selainnya cek permission cached dalam cakupan | `FORBIDDEN` + `requiredPermission` |

```typescript
// Decorator metadata permission (dibaca PermissionGuard via Reflector)
export const RequirePermissions = (...perms: string[]) =>
  SetMetadata('permissions', perms);

// Contoh mutation terkunci permission
@Mutation(() => QuestionType)
@RequirePermissions('cbt.questions.publish')
publishQuestion(@AppDb() db: Db, @Args('id', { type: () => ID }) id: string) {
  return this.questionsService.publish(db, id);
}
```

Aturan:

- Setiap operasi app-scoped **wajib** `@RequireApp()` + `@RequirePermissions(...)`. Operasi tanpa permission yang jelas adalah bug (doc 04).
- Permission didefinisikan di `<modul>.permissions.ts` dan di-seed saat booting — CMS membaca katalog yang sama (F05).

## 4. Pagination & Error

```typescript
// common/types/pagination.ts — satu-satunya bentuk daftar (doc 07)
@ArgsType()
export class PaginationArgs {
  @Field(() => Int, { defaultValue: 0 }) skip = 0;
  @Field(() => Int, { defaultValue: 20 }) take = 20; // dibatasi maks 50 di service
}

export function PaginatedType<T>(ItemType: ClassType<T>) {
  @ObjectType({ isAbstract: true })
  abstract class Paginated {
    @Field(() => [ItemType]) items: T[];
    @Field(() => Int) totalCount: number;
  }
  return Paginated;
}
```

Error: lempar exception NestJS (`Unauthorized/Forbidden/NotFound/BadRequestException` + custom `AppNotFound/SuspendedException`); filter global memetakannya ke `extensions.code` doc 07. Jangan lempar `Error` mentah. Pesan Bahasa Indonesia.

## 5. Disiplin Cache, Audit & Migrasi

- **Cache (doc 14):** domain service tidak menyentuh Redis langsung — hanya lewat `CacheService`. Setiap mutation yang mengubah data ter-cache **wajib** emit event invalidasi (`admin.updated`, `role.updated`, `app.updated`, `app-config.updated`, ...).
- **Audit (F06):** setiap mutation penting memanggil `auditService.log({...})` setelah sukses — sebelum return, bukan fire-and-forget (kecuali provisioning step 8 yang best-effort per doc 13).
- **Migrasi (doc 12):** ubah `entities/` → `drizzle-kit generate` dengan config scope yang tepat → review → `migrate:all`. Jangan edit migrasi yang sudah diterapkan; forward-fix di produksi.

## 6. Validasi, Kebersihan & Testing

- `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`). Semua `@InputType` memakai `class-validator`.
- `strict: true`, tanpa `any`, return type eksplisit di service & repository.
- N+1 dilarang: pakai dataloader/relasi join untuk field list; query kompleksitas GraphQL dibatasi (doc 07 §6).
- Testing mengikuti doc 15: unit mock repository; integration/E2E DB nyata; tiap resolver ter-guard wajib punya test ditolak + test berhasil.
