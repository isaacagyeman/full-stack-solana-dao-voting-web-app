import { pgTable, serial, integer, varchar, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { elections } from "./elections";
import { orgMembers } from "./organizations";

/**
 * Feature 3: Per-election voter tokens.
 * Generated when an election is published, one token per eligible member.
 * Sent via email + SMS. Burned (marked used) after the member votes.
 */
export const voterTokens = pgTable(
  "voter_tokens",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").references(() => organizations.id).notNull(),
    // The election this token is valid for
    electionId: integer("election_id").references(() => elections.id),
    // Which org member this token belongs to (set at publish time)
    orgMemberId: integer("org_member_id").references(() => orgMembers.id),
    // Linked user account (set when the member logs in and joins)
    userId: integer("user_id").references(() => users.id),
    token: varchar("token", { length: 64 }).notNull().unique(),
    used: boolean("used").default(false).notNull(),
    usedAt: timestamp("used_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // One token per member per election
    uniqueTokenPerElectionMember: unique("unique_token_per_election_member").on(
      table.electionId,
      table.orgMemberId
    ),
  })
);
