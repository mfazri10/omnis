import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  baAccount,
  baSession,
  baUser,
  baVerification,
} from "../modules/platform/entities/better-auth.entity";

export const AUTH = Symbol("AUTH");

export type EmailSender = (
  to: string,
  subject: string,
  html: string,
  text: string,
) => Promise<void>;

export interface AdminSignedInEvent {
  authUserId: string;
  ip: string | null;
}

export interface CreateAuthOptions {
  db: NodePgDatabase;
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
  cmsOrigin: string;
  sendEmail: EmailSender;
  /** Dipanggil sekali tiap login email berhasil (F06). Tak boleh melempar. */
  onAdminSignedIn?: (event: AdminSignedInEvent) => Promise<void>;
}

/**
 * Factory better-auth yang bebas framework (murni fungsi) agar bisa dipakai
 * AuthModule Nest maupun script seed/CLI.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- tipe generik better-auth harus di-infer agar Auth.api tetap terketik
export function createAuth(options: CreateAuthOptions) {
  return betterAuth({
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: options.trustedOrigins,
    database: drizzleAdapter(options.db, {
      provider: "pg",
      schema: {
        user: baUser,
        session: baSession,
        account: baAccount,
        verification: baVerification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      // Admin dibuat lewat seed/CMS (terpercaya), bukan registrasi publik.
      requireEmailVerification: false,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, token }) => {
        const url = `${options.cmsOrigin}/reset-password?token=${token}`;
        await options.sendEmail(
          user.email,
          "Atur ulang kata sandi CMS",
          `<p>Klik tautan berikut untuk mengatur ulang kata sandi Anda. Tautan kedaluwarsa dalam 1 jam.</p><p><a href="${url}">Atur ulang kata sandi</a></p>`,
          `Buka tautan berikut untuk mengatur ulang kata sandi Anda (kedaluwarsa 1 jam): ${url}`,
        );
      },
    },
    databaseHooks: {
      session: {
        create: {
          after: async (session, context) => {
            // Hanya login nyata: pembuatan user (sign-up) membuat sesi juga
            // tetapi bukan login dan tidak boleh tercatat sebagai login.
            if (context?.path !== "/sign-in/email") {
              return;
            }
            const forwarded =
              context.request?.headers.get("x-forwarded-for") ??
              context.request?.headers.get("x-real-ip");
            const ip = forwarded?.split(",")[0]?.trim() || null;
            await options.onAdminSignedIn?.({
              authUserId: session.userId,
              ip,
            });
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
