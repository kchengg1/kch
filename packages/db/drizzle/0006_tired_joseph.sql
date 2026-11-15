CREATE TABLE "perks_push_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "perks_push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "perks_referral" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"template_key" text,
	"card_name" text NOT NULL,
	"url" text NOT NULL,
	"reward" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perks_spend_target" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"reward" text DEFAULT '' NOT NULL,
	"target_cents" integer NOT NULL,
	"spent_cents" integer DEFAULT 0 NOT NULL,
	"period_key" text DEFAULT '' NOT NULL,
	"tracked" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perks_vapid" (
	"id" integer PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "perks_push_subscription" ADD CONSTRAINT "perks_push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perks_referral" ADD CONSTRAINT "perks_referral_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perks_spend_target" ADD CONSTRAINT "perks_spend_target_card_id_perks_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."perks_card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perks_spend_target" ADD CONSTRAINT "perks_spend_target_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "perks_push_subscription_user_id_idx" ON "perks_push_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "perks_referral_user_id_idx" ON "perks_referral" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "perks_spend_target_card_name_idx" ON "perks_spend_target" USING btree ("card_id","name");