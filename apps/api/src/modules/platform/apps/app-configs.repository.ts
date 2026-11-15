import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { Db } from "../../../database/database.service";
import { appConfigs } from "../entities/app-configs.entity";

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
}
