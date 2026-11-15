import { BadRequestException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../database/database.service";
import { RedisService } from "../../../redis/redis.service";
import { AssignmentsRepository } from "./assignments.repository";
import { PermissionsRepository } from "./permissions.repository";
import { RolesRepository } from "./roles.repository";

export interface VerifiedAdmin {
  id: string;
  isSuperAdmin: boolean;
}

const CACHE_TTL_SECONDS = 60;
const VERSION_TTL_SECONDS = 3600;

@Injectable()
export class RbacService {
  constructor(
    private readonly database: DatabaseService,
    private readonly assignments: AssignmentsRepository,
    private readonly roles: RolesRepository,
    private readonly permissions: PermissionsRepository,
    private readonly redis: RedisService,
  ) {}

  async hasPermission(
    profile: VerifiedAdmin,
    key: string,
    appId?: string,
  ): Promise<boolean> {
    if (profile.isSuperAdmin) {
      return true;
    }
    const effective = await this.listEffectivePermissions(profile.id, appId);
    return effective.includes(key);
  }

  async listEffectivePermissions(
    adminId: string,
    appId?: string,
  ): Promise<string[]> {
    const client = this.redis.getClient();
    const version =
      (await client.get(this.versionKey(adminId))) ?? "0";
    const cacheKey = this.effectiveKey(adminId, appId, version);
    const cached = await client.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as string[];
    }
    const computed = await this.computeEffective(adminId, appId);
    await client.setex(
      cacheKey,
      CACHE_TTL_SECONDS,
      JSON.stringify(computed),
    );
    return computed;
  }

  async bumpAdminVersion(adminIds: string[]): Promise<void> {
    const client = this.redis.getClient();
    for (const adminId of adminIds) {
      const key = this.versionKey(adminId);
      await client.incr(key);
      await client.expire(key, VERSION_TTL_SECONDS);
    }
  }

  private async computeEffective(
    adminId: string,
    appId?: string,
  ): Promise<string[]> {
    const db = this.database.getControlPlaneConnection();
    const numericAdmin = this.parseId(adminId);
    const contextApp =
      appId === undefined ? undefined : this.parseId(appId);
    const grants = await this.assignments.listByAdmin(db, numericAdmin);
    const catalog = await this.permissions.listByModule(db);
    const catalogKeys = catalog.map((row) => row.key);
    const held: string[] = [];
    for (const grant of grants) {
      // Role global berlaku di semua konteks; role app hanya di aplikasinya.
      // Status app TIDAK dicek di sini — AppContextGuard (F02) yang menolak suspended.
      const inScope =
        grant.scopeType === "global" ||
        (contextApp !== undefined && grant.appId === contextApp);
      if (!inScope) {
        continue;
      }
      const keys = await this.roles.findRolePermissionKeys(db, grant.roleId);
      held.push(...keys);
    }
    return expandPermissions(held, catalogKeys).sort();
  }

  private versionKey(adminId: string): string {
    return `rbac:ver:${adminId}`;
  }

  private effectiveKey(
    adminId: string,
    appId: string | undefined,
    version: string,
  ): string {
    return `rbac:eff:${adminId}:${appId ?? "global"}:${version}`;
  }

  private parseId(id: string): number {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      throw new BadRequestException("ID tidak valid.");
    }
    return numeric;
  }
}

/**
 * Ekspansi held-keys menjadi kunci konkret (R3): exact + `manage`
 * mencakup semua aksi se-entitas. Pola `*` sudah dikembangkan saat
 * validasi role (RolesService) sehingga tak pernah sampai ke sini.
 */
function expandPermissions(held: string[], catalogKeys: string[]): string[] {
  const out = new Set<string>();
  for (const key of held) {
    out.add(key);
    const segments = key.split(".");
    const module = segments[0];
    const entity = segments[1];
    const action = segments[2];
    if (
      segments.length === 3 &&
      action === "manage" &&
      module !== undefined &&
      entity !== undefined
    ) {
      const prefix = `${module}.${entity}.`;
      for (const candidate of catalogKeys) {
        if (candidate.startsWith(prefix)) {
          out.add(candidate);
        }
      }
    }
  }
  return [...out];
}
