import { isNotNull, isNull } from "drizzle-orm";
import {
  bigint,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { admins } from "./admins.entity";
import { apps } from "./apps.entity";
import { permissions } from "./permissions.entity";
import { roles } from "./roles.entity";

/** Pasangan role ↔ permission (doc 06). */
export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: bigint("role_id", { mode: "number" })
      .notNull()
      .references(() => roles.id),
    permissionId: bigint("permission_id", { mode: "number" })
      .notNull()
      .references(() => permissions.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

/**
 * Penetapan role ke admin (doc 06, R2).
 * `app_id` NULL untuk role global; composite PK tak bisa memuat kolom
 * NULL di Postgres sehingga dipakai PK surrogate + dua partial unique index.
 */
export const adminRoleAssignments = pgTable(
  "admin_role_assignments",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    adminId: bigint("admin_id", { mode: "number" })
      .notNull()
      .references(() => admins.id),
    roleId: bigint("role_id", { mode: "number" })
      .notNull()
      .references(() => roles.id),
    appId: bigint("app_id", { mode: "number" }).references(() => apps.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("ara_admin_role_uk")
      .on(t.adminId, t.roleId)
      .where(isNull(t.appId)),
    uniqueIndex("ara_admin_role_app_uk")
      .on(t.adminId, t.roleId, t.appId)
      .where(isNotNull(t.appId)),
  ],
);

export type RolePermissionRow = typeof rolePermissions.$inferSelect;
export type AdminRoleAssignmentRow = typeof adminRoleAssignments.$inferSelect;
