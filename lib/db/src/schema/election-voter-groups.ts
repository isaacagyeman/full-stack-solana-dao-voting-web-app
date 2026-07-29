import { pgTable, serial, integer, varchar, text, timestamp, unique } from "drizzle-orm/pg-core";
import { elections } from "./elections";
import { users } from "./users";
import { orgMembers } from "./organizations";

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

/**
 * Feature 4: Per-election eligibility list.
 * If any rows exist for an election, only those orgMembers can vote.
 * If no rows exist, all org members are eligible.
 */
export const electionVoters = pgTable(
  "election_voters",
  {
    id: serial("id").primaryKey(),
    electionId: integer("election_id").references(() => elections.id).notNull(),
    orgMemberId: integer("org_member_id").references(() => orgMembers.id).notNull(),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueVoterPerElection: unique("unique_voter_per_election").on(table.electionId, table.orgMemberId),
  })
);
