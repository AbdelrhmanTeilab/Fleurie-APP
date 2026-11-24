CREATE TABLE "files" (
	"name" text PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
