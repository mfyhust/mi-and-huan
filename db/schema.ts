import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const records = sqliteTable("records", {
  id: text("id").primaryKey(),
  space: text("space").notNull(),
  kind: text("kind").notNull(),
  owner: text("owner").notNull(),
  body: text("body").notNull(),
  version: integer("version").notNull().default(1),
  created: text("created").notNull(),
  updated: text("updated").notNull(),
}, (table) => [index("records_space_kind").on(table.space, table.kind), index("records_owner").on(table.space, table.owner)]);
