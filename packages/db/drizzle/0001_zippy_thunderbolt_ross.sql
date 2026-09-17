CREATE TABLE "qr_code" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"target_url" text NOT NULL,
	"scan_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "qr_code_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "qr_scan" (
	"id" text PRIMARY KEY NOT NULL,
	"code_id" text NOT NULL,
	"scanned_at" timestamp DEFAULT now() NOT NULL,
	"referer" text,
	"user_agent" text,
	"country" text
);
--> statement-breakpoint
ALTER TABLE "qr_code" ADD CONSTRAINT "qr_code_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_scan" ADD CONSTRAINT "qr_scan_code_id_qr_code_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."qr_code"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "qr_code_user_id_idx" ON "qr_code" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "qr_scan_code_id_scanned_at_idx" ON "qr_scan" USING btree ("code_id","scanned_at");