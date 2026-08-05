ALTER TABLE "vault_profile" ADD COLUMN "kdf_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_profile" ADD COLUMN "verification_ciphertext" text;--> statement-breakpoint
ALTER TABLE "vault_profile" ADD COLUMN "verification_iv" varchar(32);--> statement-breakpoint
ALTER TABLE "vault_profile" ADD COLUMN "schema_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_profile" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_record" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;