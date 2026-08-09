CREATE TABLE "pitstops" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"dropped_by_member_id" integer NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"label" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pitstop_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"pitstop_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"response" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pitstop_responses_pitstop_id_member_id_unique" UNIQUE("pitstop_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "pitstops" ADD CONSTRAINT "pitstops_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitstops" ADD CONSTRAINT "pitstops_dropped_by_member_id_trip_members_id_fk" FOREIGN KEY ("dropped_by_member_id") REFERENCES "public"."trip_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitstop_responses" ADD CONSTRAINT "pitstop_responses_pitstop_id_pitstops_id_fk" FOREIGN KEY ("pitstop_id") REFERENCES "public"."pitstops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitstop_responses" ADD CONSTRAINT "pitstop_responses_member_id_trip_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."trip_members"("id") ON DELETE no action ON UPDATE no action;
