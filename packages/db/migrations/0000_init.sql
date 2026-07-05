CREATE TABLE "radios" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"stream_url" text NOT NULL,
	"stream_type" text DEFAULT 'mp3' NOT NULL,
	"category" text DEFAULT 'D' NOT NULL,
	"website_url" text,
	"logo_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"stream_status" text DEFAULT 'unknown' NOT NULL,
	"last_ok_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" serial PRIMARY KEY NOT NULL,
	"radio_id" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"duration_seconds" real,
	"completeness" real,
	"file_id" text,
	"file_size" bigint,
	"format" text,
	"bitrate_kbps" real,
	"parts_count" integer,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"radio_id" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"message" text
);
--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_radio_id_radios_id_fk" FOREIGN KEY ("radio_id") REFERENCES "public"."radios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_events" ADD CONSTRAINT "stream_events_radio_id_radios_id_fk" FOREIGN KEY ("radio_id") REFERENCES "public"."radios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "radios_slug_idx" ON "radios" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "recordings_radio_hour_idx" ON "recordings" USING btree ("radio_id","started_at");--> statement-breakpoint
CREATE INDEX "recordings_started_at_idx" ON "recordings" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "stream_events_at_idx" ON "stream_events" USING btree ("at");
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
