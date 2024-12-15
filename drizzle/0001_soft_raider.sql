ALTER TABLE "images" DROP CONSTRAINT "images_url_unique";--> statement-breakpoint
/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'images'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

-- ALTER TABLE "images" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
ALTER TABLE "images" ALTER COLUMN "url" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "images" ALTER COLUMN "url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "id" uuid PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_id_unique" UNIQUE("id");