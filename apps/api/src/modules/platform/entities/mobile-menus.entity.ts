import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { apps } from "./apps.entity";

export const menus = pgTable(
  "menus",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    appId: bigint("app_id", { mode: "number" })
      .notNull()
      .references(() => apps.id),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    routeKey: varchar("route_key", { length: 255 }),
    iconKey: varchar("icon_key", { length: 255 }),
    parentId: bigint("parent_id", { mode: "number" }),
    orderNo: integer("order_no").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("menus_app_slug_uk").on(table.appId, table.slug),
    uniqueIndex("menus_app_id_id_uk").on(table.appId, table.id),
    index("menus_app_parent_idx").on(table.appId, table.parentId),
    foreignKey({
      name: "menus_parent_app_fk",
      columns: [table.appId, table.parentId],
      foreignColumns: [table.appId, table.id],
    }).onDelete("restrict"),
  ],
);

export type MobileMenuRow = typeof menus.$inferSelect;
