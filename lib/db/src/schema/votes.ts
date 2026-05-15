import { pgTable, serial, integer, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { elections } from "./elections";
import { users } from "./users";

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  electionId: integer("election_id").references(() => elections.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  choices: jsonb("choices").notNull().$type<number[]>(),
  voteHash: varchar("vote_hash", { length: 64 }).notNull(),
  txSignature: varchar("tx_signature", { length: 88 }),
  blockHeight: integer("block_height"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
