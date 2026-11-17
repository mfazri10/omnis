import { Injectable } from "@nestjs/common";
import type { Db } from "../../../../database/database.service";
import { MediaRepository } from "../../media/media.repository";
import type { DashboardSection } from "../dashboard-section";

/** Kartu "File Media": jumlah baris `media` di App DB konteks. */
@Injectable()
export class MediaDashboardSection implements DashboardSection {
  readonly key = "media";
  readonly label = "File Media";

  constructor(private readonly media: MediaRepository) {}

  async resolve(ctx: { appId: string; db: Db }): Promise<{
    value: number;
    hint?: string;
  }> {
    void ctx.appId;
    const value = await this.media.count(ctx.db, {});
    return { value, hint: `${value} file tersimpan` };
  }
}
