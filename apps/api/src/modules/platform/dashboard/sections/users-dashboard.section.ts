import { Injectable } from "@nestjs/common";
import type { Db } from "../../../../database/database.service";
import { AppUsersRepository } from "../../app-users/app-users.repository";
import type { DashboardSection } from "../dashboard-section";

/** Kartu "User Aplikasi": jumlah baris `users` di App DB konteks. */
@Injectable()
export class UsersDashboardSection implements DashboardSection {
  readonly key = "users";
  readonly label = "User Aplikasi";

  constructor(private readonly users: AppUsersRepository) {}

  async resolve(ctx: { appId: string; db: Db }): Promise<{
    value: number;
    hint?: string;
  }> {
    void ctx.appId;
    const value = await this.users.count(ctx.db, {});
    return { value, hint: `${value} user terdaftar` };
  }
}
