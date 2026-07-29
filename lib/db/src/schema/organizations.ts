import { pgTable, serial, varchar, boolean, integer, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  accessCode: varchar("access_code", { length: 20 }).unique().notNull(),
  description: text("description"),
  logoUrl: varchar("logo_url", { length: 500 }),
  isPublic: boolean("is_public").default(true).notNull(),
  ownerId: integer("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orgMembers = pgTable("org_members", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").references(() => organizations.id).notNull(),
  userId: integer("user_id").references(() => users.id), // nullable — imported members start without an account
  role: varchar("role", { length: 50 }).default("voter").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  // Imported member details (populated from Excel import)
  fullName: varchar("full_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  department: varchar("department", { length: 255 }),
  position: varchar("position", { length: 255 }),
  // Invite lifecycle
  status: varchar("status", { length: 50 }).default("active").notNull(), // 'invited' | 'active'
  invitedAt: timestamp("invited_at"),
});
