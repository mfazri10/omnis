import { Module } from "@nestjs/common";
import { CbtDashboardSection } from "../../cbt/cbt-dashboard.section";
import { CbtModule } from "../../cbt/cbt.module";
import { ActivityLogsModule } from "../activity-logs/activity-logs.module";
import { AppUsersRepository } from "../app-users/app-users.repository";
import { AppsModule } from "../apps/apps.module";
import { MediaRepository } from "../media/media.repository";
import { DASHBOARD_SECTIONS } from "./dashboard-section";
import type { DashboardSection } from "./dashboard-section";
import { DashboardRepository } from "./dashboard.repository";
import { DashboardResolver } from "./dashboard.resolver";
import { DashboardService } from "./dashboard.service";
import { MediaDashboardSection } from "./sections/media-dashboard.section";
import { UsersDashboardSection } from "./sections/users-dashboard.section";

@Module({
  // AppContextGuard di resolver ini membutuhkan AppsRepository milik AppsModule.
  // CbtModule menyumbang kartu "Soal CBT" (F12) lewat DashboardSection.
  imports: [ActivityLogsModule, AppsModule, CbtModule],
  providers: [
    AppUsersRepository,
    MediaRepository,
    DashboardRepository,
    UsersDashboardSection,
    MediaDashboardSection,
    // Satu-satunya daftar section: service menerima array ini via DI
    // dan me-resolve tiap anggotanya tanpa if/else per modul.
    // Modul baru menambah kartu TANPA mengubah service/resolver/tipe:
    //
    //   // 1. Buat section di modul penyumbang (contoh F12):
    //   @Injectable()
    //   export class CbtDashboardSection implements DashboardSection {
    //     readonly key = "cbt_questions";
    //     readonly label = "Soal CBT";
    //     async resolve({ db }) { ...hitung di App DB... }
    //   }
    //
    //   // 2. Daftarkan class-nya di providers + inject + array di bawah
    //   //    (service/resolver dasbor tak tersentuh).
    {
      provide: DASHBOARD_SECTIONS,
      useFactory: (
        users: UsersDashboardSection,
        media: MediaDashboardSection,
        cbt: CbtDashboardSection,
      ): DashboardSection[] => [users, media, cbt],
      inject: [UsersDashboardSection, MediaDashboardSection, CbtDashboardSection],
    },
    DashboardService,
    DashboardResolver,
  ],
})
export class DashboardModule {}
