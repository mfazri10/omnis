import {
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { AdminsService } from "../modules/platform/admins/admins.service";
import type { AdminProfile } from "../modules/platform/admins/admins.service";
import { AUTH } from "./better-auth";
import type { Auth } from "./better-auth";
import { SessionRepository } from "./session.repository";

export interface VerifiedSession {
  admin: AdminProfile;
  userId: string;
}

export interface CreateAdminAccountInput {
  name: string;
  email: string;
  password: string;
  isSuperAdmin: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly admins: AdminsService,
    private readonly sessions: SessionRepository,
    private readonly database: DatabaseService,
  ) {}

  async verifySession(
    headers: Record<string, string>,
  ): Promise<VerifiedSession | null> {
    const session = await this.auth.api.getSession({
      headers: new Headers(headers),
    });
    if (!session?.user) {
      return null;
    }
    const admin = await this.admins.findActiveByAuthUserId(session.user.id);
    if (!admin) {
      return null;
    }
    return { admin, userId: session.user.id };
  }

  async createAdminAccount(
    input: CreateAdminAccountInput,
  ): Promise<AdminProfile> {
    const existing = await this.admins.findByEmail(input.email);
    if (existing) {
      throw new ConflictException("Email sudah dipakai admin lain.");
    }
    let userId: string;
    try {
      const result = await this.auth.api.signUpEmail({
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
        },
      });
      userId = result.user.id;
    } catch (error: unknown) {
      throw this.toConflict(error);
    }
    return this.admins.createProfile({
      authUserId: userId,
      name: input.name,
      email: input.email,
      isSuperAdmin: input.isSuperAdmin,
    });
  }

  async revokeSessions(userId: string): Promise<number> {
    return this.sessions.deleteByUserId(
      this.database.getControlPlaneConnection(),
      userId,
    );
  }

  private toConflict(error: unknown): Error {
    if (error instanceof ConflictException) {
      return error;
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error
    ) {
      const statusCode: unknown = error.statusCode;
      if (statusCode === 422 || statusCode === 409) {
        return new ConflictException("Email sudah dipakai admin lain.");
      }
    }
    throw error;
  }
}
