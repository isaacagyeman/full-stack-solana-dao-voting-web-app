import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

/**
 * An election bundle groups multiple elections into a single voting session.
 * Voters go through each election in the bundle sequentially (Feature 6).
 */
export const electionBundles = pgTable("election_bundles", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").references(() => organizations.id).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  status: varchar("status", { length: 50 }).default("draft").notNull(), // draft | active | closed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
