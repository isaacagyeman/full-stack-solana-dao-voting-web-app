import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const votesTable = pgTable("votes", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").notNull(),
  voterAddress: text("voter_address").notNull(),
  voteType: text("vote_type").notNull(),
  votingPower: integer("voting_power").notNull().default(1),
  txSignature: text("tx_signature"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVoteSchema = createInsertSchema(votesTable).omit({ id: true, createdAt: true });
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votesTable.$inferSelect;
