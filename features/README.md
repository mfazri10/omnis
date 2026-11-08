# Daftar Fitur — Platform CMS Multi-Aplikasi

Peta kerja Fase 1 (CMS/platform). Satu file per fitur berisi tujuan, lingkup backend + CMS UI, dan kriteria selesai. Status tiap fitur diubah di file-nya masing-masing saat dikerjakan.

Status yang dipakai: `Belum mulai` · `Dikerjakan` · `Selesai` · `Ditunda`.

## Urutan Bangun yang Disarankan

Fondasi dulu, lalu auth + RBAC (pintu semua operasi), lalu registry (konteks aplikasi), lalu layanan platform, terakhir modul pilot:

```text
F00 → F01 → F05 → F03 → F02 → F04 → F06 → F08 → F09 → F10 → F07 → F11 → F12
```

## Daftar

| ID | Fitur | FR | Fase | Status |
|---|---|---|---|---|
| F00 | [Fondasi Proyek & Infrastruktur](F00-fondasi-proyek.md) | — | 0–1 | Belum mulai |
| F01 | [Auth Admin](F01-auth-admin.md) | FR-PLAT-01 | 1 | Belum mulai |
| F02 | [Kerangka CMS & App Switcher](F02-kerangka-cms-app-switcher.md) | FR-PLAT-02 | 1 | Belum mulai |
| F03 | [Registry & Provisioning Aplikasi](F03-registry-provisioning.md) | FR-PLAT-03, 04 | 1 | Belum mulai |
| F04 | [Remote Config per Aplikasi](F04-remote-config.md) | FR-PLAT-05 | 1 | Belum mulai |
| F05 | [RBAC Dinamis](F05-rbac-dinamis.md) | FR-PLAT-06, 07 | 1 | Belum mulai |
| F06 | [Audit Log](F06-audit-log.md) | FR-PLAT-08 | 1 | Belum mulai |
| F07 | [Dashboard Global & per Aplikasi](F07-dashboard.md) | FR-PLAT-09, 10 | 1 | Belum mulai |
| F08 | [Manajemen User Aplikasi](F08-user-aplikasi.md) | FR-PLAT-11 | 1 | Belum mulai |
| F09 | [Media Library](F09-media-library.md) | FR-PLAT-12 | 1 | Belum mulai |
| F10 | [Notifikasi Push](F10-notifikasi-push.md) | FR-PLAT-13, 14 | 1 | Belum mulai |
| F11 | [Ekspor CSV](F11-ekspor-csv.md) | FR-PLAT-15 (Should) | 1–2 | Belum mulai |
| F12 | [Modul Pilot](F12-modul-pilot.md) | FR-CBT/POS/DEB | 2 | Belum mulai — menunggu Q1 |

Referensi kebutuhan: [docs/02-prd.md](../docs/02-prd.md). Arsitektur: [docs/05-arsitektur-sistem.md](../docs/05-arsitektur-sistem.md).
