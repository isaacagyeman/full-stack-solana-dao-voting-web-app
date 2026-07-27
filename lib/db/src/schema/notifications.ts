import { pgTable, serial, integer, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { elections } from "./elections";
import { users } from "./users";

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  electionId: integer("election_id").references(() => elections.id).notNull(),
  recipientId: integer("recipient_id").references(() => users.id).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'election_result', 'election_reminder', etc.
  subject: varchar("subject", { length: 255 }).notNull(),
  message: text("message").notNull(),
  recipient: varchar("recipient", { length: 255 }).notNull(), // email or phone number
  channel: varchar("channel", { length: 50 }).notNull(), // 'email', 'sms'
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  failedAt: timestamp("failed_at"),
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  emailNotifications: boolean("email_notifications").default(true).notNull(),
  smsNotifications: boolean("sms_notifications").default(true).notNull(),
  resultNotifications: boolean("result_notifications").default(true).notNull(),
  reminderNotifications: boolean("reminder_notifications").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
