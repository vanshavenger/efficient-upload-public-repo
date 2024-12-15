CREATE TABLE "images" (
	"url" uuid PRIMARY KEY NOT NULL,
	"metadata" text,
	"userId" text,
	"timestamp" integer,
	CONSTRAINT "images_url_unique" UNIQUE("url")
);
