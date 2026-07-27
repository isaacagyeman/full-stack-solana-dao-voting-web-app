import { pgTable, serial, integer, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { elections } from "./elections";

export const polls = pgTable("polls", {
  id: serial("id").primaryKey(),
  electionId: integer("election_id").references(() => elections.id).notNull(),
  question: varchar("question", { length: 500 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).default("single").notNull(), // single, multi, yes-no
  maxChoices: integer("max_choices").default(1).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pollOptions = pgTable("poll_options", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").references(() => polls.id).notNull(),
  text: varchar("text", { length: 255 }).notNull(),
  description: text("description"),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pollVotes = pgTable("poll_votes", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").references(() => polls.id).notNull(),
  electionVoteId: integer("election_vote_id"), // Links to parent election vote session
  selectedOptionIds: text("selected_option_ids").$type<string>().notNull(), // JSON array of selected option IDs
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
