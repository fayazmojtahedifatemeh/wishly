CREATE TYPE "public"."item_status" AS ENUM('pending', 'processed', 'failed', 'link_dead');--> statement-breakpoint
CREATE TABLE "goals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"target_amount" integer NOT NULL,
	"current_amount" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"deadline" timestamp,
	"item_ids" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"url" text NOT NULL,
	"short_url" text,
	"images" jsonb DEFAULT '[]'::jsonb,
	"price" integer,
	"currency" text DEFAULT 'USD',
	"size" text,
	"available_sizes" jsonb DEFAULT '[]'::jsonb,
	"available_colors" jsonb DEFAULT '[]'::jsonb,
	"in_stock" boolean DEFAULT true,
	"lists" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"status" "item_status" DEFAULT 'pending',
	"last_checked_at" timestamp,
	"last_check_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lists_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" varchar NOT NULL,
	"price" integer NOT NULL,
	"currency" text NOT NULL,
	"in_stock" boolean NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;