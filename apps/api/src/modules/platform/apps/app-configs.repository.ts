import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { Db } from "../../../database/database.service";
import { appConfigs } from "../entities/app-configs.entity";
import type { AppConfigRow } from "../entities/app-configs.entity";

export interface UpdateAppConfigRow {
  maintenanceMode?: boolean;
  maintenanceMessage?: string | null;
  minVersionAndroid?: string;
  minVersionIos?: string;
  themePrimaryColor?: string;
  logoMediaUrl?: string | null;
  supportEmail?: string | null;
  supportWhatsapp?: string | null;
  updatedAt?: Date;
}

@Injectable()
export class AppConfigsRepository {
  async insertDefault(db: Db, appId: number): Promise<void> {
    await db.insert(appConfigs).values({
      appId,
      maintenanceMode: false,
      minVersionAndroid: "1.0.0",
      minVersionIos: "1.0.0",
      themePrimaryColor: "#1976D2",
    });
  }

  async deleteByAppId(db: Db, appId: number): Promise<void> {
    await db.delete(appConfigs).where(eq(appConfigs.appId, appId));
  }

  async findByAppId(db: Db, appId: number): Promise<AppConfigRow | null> {
    const rows = await db
      .select()
      .from(appConfigs)
      .where(eq(appConfigs.appId, appId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Sisip default bila belum ada; konflik PK diabaikan agar panggilan
   * berulang (atau balapan dua request) tetap idempoten.
   */
  async insertDefaultIfMissing(db: Db, appId: number): Promise<void> {
    await db
      .insert(appConfigs)
      .values({
        appId,
        maintenanceMode: false,
        minVersionAndroid: "1.0.0",
        minVersionIos: "1.0.0",
        themePrimaryColor: "#1976D2",
      })
      .onConflictDoNothing();
  }

  async updateByAppId(
    db: Db,
    appId: number,
    patch: UpdateAppConfigRow,
  ): Promise<void> {
    await db
      .update(appConfigs)
      .set(patch)
      .where(eq(appConfigs.appId, appId));
  }
}
