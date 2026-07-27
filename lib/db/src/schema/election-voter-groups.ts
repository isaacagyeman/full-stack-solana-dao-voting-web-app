import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { elections } from "./elections";
import { users } from "./users";

export const electionVoterGroups = pgTable("election_voter_groups", {
  id: serial("id").primaryKey(),
  electionId: integer("election_id").references(() => elections.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const electionGroupMembers = pgTable("election_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => electionVoterGroups.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});
