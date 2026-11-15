CREATE TABLE "perks_hidden_merchant" (
	"user_id" text NOT NULL,
	"merchant_key" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "perks_hidden_merchant_user_id_merchant_key_pk" PRIMARY KEY("user_id","merchant_key")
);
--> statement-breakpoint
ALTER TABLE "perks_hidden_merchant" ADD CONSTRAINT "perks_hidden_merchant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;