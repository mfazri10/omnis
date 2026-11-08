import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../database/database.service";
import { AdminsRepository } from "./admins.repository";
import type { CreateProfileInput } from "./admins.repository";
import type { AdminRow } from "../entities/admins.entity";

export interface AdminProfile {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
}

function toProfile(row: AdminRow): AdminProfile {
  return {
    id: String(row.id),
    authUserId: row.authUserId,
    name: row.name,
    email: row.email,
    isSuperAdmin: row.isSuperAdmin,
  };
}

@Injectable()
export class AdminsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly admins: AdminsRepository,
  ) {}

  async findActiveByAuthUserId(
    authUserId: string,
  ): Promise<AdminProfile | null> {
    const row = await this.admins.findByAuthUserId(
      this.database.getControlPlaneConnection(),
      authUserId,
    );
    if (!row || !row.isActive) {
      return null;
    }
    return toProfile(row);
  }

  async findByEmail(email: string): Promise<AdminProfile | null> {
    const row = await this.admins.findByEmail(
      this.database.getControlPlaneConnection(),
      email,
    );
    return row ? toProfile(row) : null;
  }

  async createProfile(input: CreateProfileInput): Promise<AdminProfile> {
    const row = await this.admins.createProfile(
      this.database.getControlPlaneConnection(),
      input,
    );
    return toProfile(row);
  }
}
