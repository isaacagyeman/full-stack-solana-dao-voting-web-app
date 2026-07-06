import { pgTable, serial, varchar, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).default("voter").notNull(),
  phone: varchar("phone", { length: 50 }),
  emailVerified: boolean("email_verified").default(true).notNull(),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  verificationLevel: integer("verification_level").default(1).notNull(),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
