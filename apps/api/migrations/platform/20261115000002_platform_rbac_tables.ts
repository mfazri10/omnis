import { sql } from "drizzle-orm";
import type { MigrationContext } from "../../src/database/migration/migration-runner";

// SQL hasil `drizzle-kit generate` dari entities/ (verbatim, bukan input user).
// Pernyataan tabel `apps` dibuang: sudah diterapkan M1 (journal generate tak dilacak, konvensi F01).
const UP_SQL = `CREATE TYPE "public"."role_scope" AS ENUM('global', 'app');--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"key" varchar(255) NOT NULL,
	"module" varchar(64) NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_role_assignments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_role_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"admin_id" bigint NOT NULL,
	"role_id" bigint NOT NULL,
	"app_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" bigint NOT NULL,
	"permission_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"description" varchar(512),
	"scope_type" "role_scope" NOT NULL,
	"app_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_role_assignments" ADD CONSTRAINT "admin_role_assignments_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_role_assignments" ADD CONSTRAINT "admin_role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_role_assignments" ADD CONSTRAINT "admin_role_assignments_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_key_uk" ON "permissions" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "ara_admin_role_uk" ON "admin_role_assignments" USING btree ("admin_id","role_id") WHERE "admin_role_assignments"."app_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ara_admin_role_app_uk" ON "admin_role_assignments" USING btree ("admin_id","role_id","app_id") WHERE "admin_role_assignments"."app_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_global_uk" ON "roles" USING btree ("name") WHERE "scope_type" = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_app_uk" ON "roles" USING btree ("name","app_id") WHERE "scope_type" = 'app';`;

export async function up({ db }: MigrationContext): Promise<void> {
  await db.execute(sql.raw(UP_SQL));
}

export async function down({ db }: MigrationContext): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "admin_role_assignments"`);
  await db.execute(sql`DROP TABLE IF EXISTS "role_permissions"`);
  await db.execute(sql`DROP TABLE IF EXISTS "permissions"`);
  await db.execute(sql`DROP TABLE IF EXISTS "roles"`);
  await db.execute(sql`DROP TYPE IF EXISTS "public"."role_scope"`);
}
