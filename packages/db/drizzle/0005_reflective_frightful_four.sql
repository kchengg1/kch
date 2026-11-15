CREATE TABLE "perks_points" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"program" text NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"cents_per_point_x100" integer DEFAULT 100 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perks_redemption" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"program" text NOT NULL,
	"redeemed_on" date NOT NULL,
	"points" integer NOT NULL,
	"fees_cents" integer DEFAULT 0 NOT NULL,
	"cash_cents" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "perks_benefit" ADD COLUMN "my_value_cents" integer;--> statement-breakpoint
ALTER TABLE "perks_card" ADD COLUMN "msr_cents" integer;--> statement-breakpoint
ALTER TABLE "perks_card" ADD COLUMN "msr_deadline" date;--> statement-breakpoint
ALTER TABLE "perks_card" ADD COLUMN "msr_spent_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "perks_card" ADD COLUMN "bonus_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "perks_card" ADD COLUMN "bonus_received_on" date;--> statement-breakpoint
ALTER TABLE "perks_points" ADD CONSTRAINT "perks_points_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perks_redemption" ADD CONSTRAINT "perks_redemption_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "perks_points_user_program_idx" ON "perks_points" USING btree ("user_id","program");--> statement-breakpoint
CREATE INDEX "perks_redemption_user_id_idx" ON "perks_redemption" USING btree ("user_id");