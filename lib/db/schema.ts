import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

export const imagesTable = pgTable("images", {
  id: uuid().unique().primaryKey(),
  url: text(),
  metadata: text(),
  userId: text(),
  timestamp: integer(),
});
