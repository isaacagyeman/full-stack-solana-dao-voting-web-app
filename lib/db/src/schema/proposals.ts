import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const proposalsTable = pgTable("proposals", {
  id: serial("id").primaryKey(),
  daoId: integer("dao_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  creatorAddress: text("creator_address").notNull(),
  status: text("status").notNull().default("active"),
  votesFor: integer("votes_for").notNull().default(0),
  votesAgainst: integer("votes_against").notNull().default(0),
  votesAbstain: integer("votes_abstain").notNull().default(0),
  quorumRequired: integer("quorum_required").notNull().default(10),
  txSignature: text("tx_signature"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProposalSchema = createInsertSchema(proposalsTable).omit({ id: true, createdAt: true, votesFor: true, votesAgainst: true, votesAbstain: true });
export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposalsTable.$inferSelect;
