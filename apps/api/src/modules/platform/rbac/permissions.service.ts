import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../database/database.service";
import type { PermissionRow } from "../entities/permissions.entity";
import { PermissionsRepository } from "./permissions.repository";
import type { PermissionDef } from "./platform.permissions";

@Injectable()
export class PermissionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly permissions: PermissionsRepository,
  ) {}

  /**
   * Sinkronkan katalog ke tabel: sisipkan kunci hilang, perbarui
   * modul/label/deskripsi yang berubah, lewati yang identik. Idempoten.
   */
  async syncCatalog(
    defs: PermissionDef[],
  ): Promise<{ inserted: number; updated: number }> {
    const db = this.database.getControlPlaneConnection();
    let inserted = 0;
    let updated = 0;
    for (const def of defs) {
      const existing = await this.permissions.findByKey(db, def.key);
      if (!existing) {
        await this.permissions.insert(db, def);
        inserted += 1;
        continue;
      }
      const same =
        existing.module === def.module &&
        existing.label === def.label &&
        (existing.description ?? undefined) === (def.description ?? undefined);
      if (!same) {
        await this.permissions.updateByKey(db, def.key, {
          module: def.module,
          label: def.label,
          description: def.description,
        });
        updated += 1;
      }
    }
    return { inserted, updated };
  }

  async listByModule(module?: string): Promise<PermissionRow[]> {
    return this.permissions.listByModule(
      this.database.getControlPlaneConnection(),
      module,
    );
  }
}
