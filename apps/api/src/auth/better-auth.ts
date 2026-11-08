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

export interface CreateAuthOptions {
  db: NodePgDatabase;
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
  cmsOrigin: string;
  sendEmail: EmailSender;
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
  });
}

export type Auth = ReturnType<typeof createAuth>;
