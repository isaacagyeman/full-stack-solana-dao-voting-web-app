import { pgTable, serial, integer, varchar, integer as intCol, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const bulkVoterUploads = pgTable("bulk_voter_uploads", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").references(() => organizations.id).notNull(),
  uploadedBy: integer("uploaded_by").references(() => users.id).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  totalRows: intCol("total_rows").notNull(),
  successfulRows: intCol("successful_rows").default(0).notNull(),
  failedRows: intCol("failed_rows").default(0).notNull(),
  errorLog: text("error_log"), // JSON array of errors
  status: varchar("status", { length: 50 }).default("processing").notNull(), // processing, completed, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
