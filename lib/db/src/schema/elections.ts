import { pgTable, serial, varchar, boolean, integer, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const elections = pgTable("elections", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").references(() => organizations.id).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).default("single").notNull(),
  status: varchar("status", { length: 50 }).default("draft").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
  maxChoices: integer("max_choices").default(1).notNull(),
  quorum: integer("quorum").default(0).notNull(),
  electionHash: varchar("election_hash", { length: 64 }),
  requiredGroupId: integer("required_group_id"), // FEATURE 4: Null means all members can vote
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  electionId: integer("election_id").references(() => elections.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: varchar("image_url", { length: 500 }),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
