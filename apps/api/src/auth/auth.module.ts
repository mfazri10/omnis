import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "../common/guards/auth.guard";
import { DatabaseService } from "../database/database.service";
import { EmailModule } from "../email/email.module";
import { EmailService } from "../email/email.service";
import { ActivityLogService } from "../modules/platform/activity-logs/activity-log.service";
import { ActivityLogsModule } from "../modules/platform/activity-logs/activity-logs.module";
import { AdminsModule } from "../modules/platform/admins/admins.module";
import { AdminsService } from "../modules/platform/admins/admins.service";
import { AUTH, createAuth } from "./better-auth";
import { AuthService } from "./auth.service";
import { SessionRepository } from "./session.repository";

// Global: guard auth dipakai di semua modul domain (F05+).
@Global()
@Module({
  imports: [ActivityLogsModule, AdminsModule, EmailModule],
  providers: [
    {
      provide: AUTH,
      inject: [
        ConfigService,
        DatabaseService,
        EmailService,
        ActivityLogService,
        AdminsService,
      ],
      useFactory: (
        config: ConfigService,
        database: DatabaseService,
        email: EmailService,
        activityLog: ActivityLogService,
        admins: AdminsService,
      ) =>
        createAuth({
          db: database.getControlPlaneConnection(),
          secret: config.getOrThrow<string>("BETTER_AUTH_SECRET"),
          baseURL: config.getOrThrow<string>("BETTER_AUTH_URL"),
          trustedOrigins: config
            .getOrThrow<string>("CORS_ORIGIN")
            .split(",")
            .map((o) => o.trim()),
          cmsOrigin: config.getOrThrow<string>("CMS_ORIGIN"),
          sendEmail: email.asSender(),
          onAdminSignedIn: async ({ authUserId, ip }) => {
            try {
              const admin =
                await admins.findActiveByAuthUserId(authUserId);
              if (!admin) {
                return;
              }
              await activityLog.record({
                adminId: admin.id,
                appId: null,
                action: "login",
                entityType: "admin",
                entityId: admin.id,
                summary: "Masuk ke CMS",
                ip,
              });
            } catch (error: unknown) {
              console.error("Gagal mencatat audit login:", error);
            }
          },
        }),
    },
    AuthService,
    AuthGuard,
    SessionRepository,
  ],
  exports: [AUTH, AuthService, AuthGuard, SessionRepository],
})
export class AuthModule {}
