import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const daosTable = pgTable("daos", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  governanceToken: text("governance_token").notNull(),
  treasuryAddress: text("treasury_address").notNull(),
  creatorAddress: text("creator_address").notNull(),
  imageUrl: text("image_url"),
  totalMembers: integer("total_members").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDaoSchema = createInsertSchema(daosTable).omit({ id: true, createdAt: true });
export type InsertDao = z.infer<typeof insertDaoSchema>;
export type Dao = typeof daosTable.$inferSelect;
