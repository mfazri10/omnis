import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "../common/guards/auth.guard";
import { DatabaseService } from "../database/database.service";
import { EmailModule } from "../email/email.module";
import { EmailService } from "../email/email.service";
import { AdminsModule } from "../modules/platform/admins/admins.module";
import { AUTH, createAuth } from "./better-auth";
import { AuthService } from "./auth.service";
import { SessionRepository } from "./session.repository";

// Global: guard auth dipakai di semua modul domain (F05+).
@Global()
@Module({
  imports: [AdminsModule, EmailModule],
  providers: [
    {
      provide: AUTH,
      inject: [ConfigService, DatabaseService, EmailService],
      useFactory: (
        config: ConfigService,
        database: DatabaseService,
        email: EmailService,
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
        }),
    },
    AuthService,
    AuthGuard,
    SessionRepository,
  ],
  exports: [AUTH, AuthService, AuthGuard],
})
export class AuthModule {}
