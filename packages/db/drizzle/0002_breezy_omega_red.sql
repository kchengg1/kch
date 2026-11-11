CREATE TABLE "perks_benefit" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"cadence" text NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"enroll_required" boolean DEFAULT false NOT NULL,
	"enrolled" boolean DEFAULT false NOT NULL,
	"tracked" boolean DEFAULT true NOT NULL,
	"ends_on" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perks_card" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"issuer" text DEFAULT '' NOT NULL,
	"template_key" text,
	"business" boolean DEFAULT false NOT NULL,
	"annual_fee_cents" integer DEFAULT 0 NOT NULL,
	"opened_on" date,
	"closed_on" date,
	"closed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perks_offer" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"card_id" text,
	"merchant" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"value_cents" integer,
	"expires_on" date,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perks_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"digest_enabled" boolean DEFAULT true NOT NULL,
	"last_digest_on" date
);
--> statement-breakpoint
CREATE TABLE "perks_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"benefit_id" text NOT NULL,
	"user_id" text NOT NULL,
	"period_key" text NOT NULL,
	"used_cents" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "perks_benefit" ADD CONSTRAINT "perks_benefit_card_id_perks_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."perks_card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perks_benefit" ADD CONSTRAINT "perks_benefit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perks_card" ADD CONSTRAINT "perks_card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perks_offer" ADD CONSTRAINT "perks_offer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perks_offer" ADD CONSTRAINT "perks_offer_card_id_perks_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."perks_card"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perks_settings" ADD CONSTRAINT "perks_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perks_usage" ADD CONSTRAINT "perks_usage_benefit_id_perks_benefit_id_fk" FOREIGN KEY ("benefit_id") REFERENCES "public"."perks_benefit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perks_usage" ADD CONSTRAINT "perks_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "perks_benefit_card_id_idx" ON "perks_benefit" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "perks_card_user_id_idx" ON "perks_card" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "perks_offer_user_id_idx" ON "perks_offer" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "perks_usage_benefit_period_idx" ON "perks_usage" USING btree ("benefit_id","period_key");