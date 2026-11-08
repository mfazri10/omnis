import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { Db } from "../database/database.service";
import { baSession } from "../modules/platform/entities/better-auth.entity";

@Injectable()
export class SessionRepository {
  async deleteByUserId(db: Db, userId: string): Promise<number> {
    const deleted = await db
      .delete(baSession)
      .where(eq(baSession.userId, userId))
      .returning({ id: baSession.id });
    return deleted.length;
  }
}
