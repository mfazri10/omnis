import { Injectable } from "@nestjs/common";
import { asc, eq, gte } from "drizzle-orm";
import type { Db } from "../../../database/database.service";
import { campaignDeviceTokens } from "./device-tokens.entity";

export interface DeviceTokenItem {
  id: number;
  token: string;
}

/**
 * Akses baca-hapus token FCM di SATU App DB (doc 05 §4.4: pengecualian
 * lintas-DB yang diizinkan untuk worker notifikasi). Koneksi App DB
 * selalu diturunkan dari `app_id` kampanye, bukan dari header request.
 */
@Injectable()
export class DeviceTokensRepository {
  async listTokens(
    db: Db,
    options: { activeSince?: Date } = {},
  ): Promise<DeviceTokenItem[]> {
    const where =
      options.activeSince === undefined
        ? undefined
        : gte(campaignDeviceTokens.lastSeenAt, options.activeSince);
    return db
      .select({
        id: campaignDeviceTokens.id,
        token: campaignDeviceTokens.token,
      })
      .from(campaignDeviceTokens)
      .where(where)
      .orderBy(asc(campaignDeviceTokens.id));
  }

  async deleteByToken(db: Db, token: string): Promise<void> {
    await db
      .delete(campaignDeviceTokens)
      .where(eq(campaignDeviceTokens.token, token));
  }
}
