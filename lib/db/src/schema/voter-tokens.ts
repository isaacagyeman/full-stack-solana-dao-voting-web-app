import { pgTable, serial, integer, varchar, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const voterTokens = pgTable(
  "voter_tokens",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").references(() => organizations.id).notNull(),
    userId: integer("user_id").references(() => users.id).notNull(),
    token: varchar("token", { length: 64 }).notNull(),
    used: boolean("used").default(false).notNull(),
    usedAt: timestamp("used_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueTokenPerOrgUser: unique("unique_token_per_org_user").on(table.orgId, table.userId),
  })
);
