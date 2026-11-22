import { sql } from "drizzle-orm";
import type { MigrationContext } from "../migration-runner";

// SQL hasil `drizzle-kit generate` dari modules/cbt/entities (verbatim,
// bukan input user). Hanya pernyataan tabel cbt_* yang disalin: tabel
// `users` sudah dibuat migrasi app-template (konvensi F06/F10).
// Scope ini diterapkan per App DB aplikasi pemilik modul CBT:
//   bun run db:migrate up --scope app-cbt --db app_<slug>
const UP_SQL = `CREATE TABLE "cbt_answers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cbt_answers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"session_id" bigint NOT NULL,
	"question_id" bigint NOT NULL,
	"selected_option" varchar(1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cbt_package_questions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cbt_package_questions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"package_id" bigint NOT NULL,
	"question_id" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cbt_packages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cbt_packages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" varchar(255) NOT NULL,
	"description" text,
	"duration_minutes" integer DEFAULT 100 NOT NULL,
	"passing_grade" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cbt_questions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cbt_questions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"category" varchar(8) NOT NULL,
	"stem" text NOT NULL,
	"image_url" varchar(512),
	"option_a" text NOT NULL,
	"option_b" text NOT NULL,
	"option_c" text NOT NULL,
	"option_d" text NOT NULL,
	"option_e" text NOT NULL,
	"correct_option" varchar(1),
	"tkp_weights" jsonb,
	"explanation" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cbt_results" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cbt_results_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"session_id" bigint NOT NULL,
	"twk_score" integer DEFAULT 0 NOT NULL,
	"tiu_score" integer DEFAULT 0 NOT NULL,
	"tkp_score" integer DEFAULT 0 NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"passed" boolean NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cbt_sessions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cbt_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"package_id" bigint NOT NULL,
	"app_user_id" bigint,
	"participant_name" varchar(255) NOT NULL,
	"status" varchar(16) DEFAULT 'ongoing' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_by" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cbt_answers" ADD CONSTRAINT "cbt_answers_session_id_cbt_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."cbt_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_answers" ADD CONSTRAINT "cbt_answers_question_id_cbt_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."cbt_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_package_questions" ADD CONSTRAINT "cbt_package_questions_package_id_cbt_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."cbt_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_package_questions" ADD CONSTRAINT "cbt_package_questions_question_id_cbt_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."cbt_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_results" ADD CONSTRAINT "cbt_results_session_id_cbt_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."cbt_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_sessions" ADD CONSTRAINT "cbt_sessions_package_id_cbt_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."cbt_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cbt_sessions" ADD CONSTRAINT "cbt_sessions_app_user_id_users_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cbt_answers_session_question_uk" ON "cbt_answers" USING btree ("session_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cbt_package_questions_uk" ON "cbt_package_questions" USING btree ("package_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cbt_results_session_uk" ON "cbt_results" USING btree ("session_id");`;

export async function up({ db }: MigrationContext): Promise<void> {
  await db.execute(sql.raw(UP_SQL));
}

export async function down({ db }: MigrationContext): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "cbt_answers";
    DROP TABLE IF EXISTS "cbt_results";
    DROP TABLE IF EXISTS "cbt_package_questions";
    DROP TABLE IF EXISTS "cbt_sessions";
    DROP TABLE IF EXISTS "cbt_packages";
    DROP TABLE IF EXISTS "cbt_questions";
  `);
}
