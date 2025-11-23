import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // 'admin' or 'user'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "set null" }),
  clientName: text("client_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  subject: text("subject"),
  leadDetails: text("lead_details"),
  notes: text("notes"), // Internal notes/comments for the lead
  status: text("status").notNull().default("New"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const emails = pgTable("emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  direction: text("direction").notNull(), // 'sent' or 'received'
  messageId: text("message_id"), // Microsoft Graph Message ID for tracking
  conversationId: text("conversation_id"), // Thread ID for grouping
  inReplyTo: text("in_reply_to"), // Parent message ID
  fromEmail: text("from_email"),
  toEmail: text("to_email"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export const inventory = pgTable("inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productHeading: text("product_heading"), // For section headers like "PARMA SPC"
  product: text("product").notNull(),
  boxes: text("boxes"), // stored as text to handle empty values and decimals
  sqFtPerBox: text("sq_ft_per_box"), // stored as text to handle decimal precision
  totalSqFt: text("total_sq_ft"), // stored as text to handle decimal precision
  notes: text("notes"), // For additional notes like "(drop)", "(NIFW)", "discontinued"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const companiesRelations = relations(companies, ({ many }) => ({
  leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ many, one }) => ({
  emails: many(emails),
  company: one(companies, {
    fields: [leads.companyId],
    references: [companies.id],
  }),
}));

export const emailsRelations = relations(emails, ({ one }) => ({
  lead: one(leads, {
    fields: [emails.leadId],
    references: [leads.id],
  }),
}));

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailSchema = createInsertSchema(emails).omit({
  id: true,
  sentAt: true,
});

export const insertInventorySchema = z.object({
  product: z.string(),
  boxes: z.string().nullable(),
  sqFtPerBox: z.string().nullable(),
  totalSqFt: z.string().nullable(),
  productHeading: z.string().nullable(),
  notes: z.string().nullable(),
});

// Member permissions table for granular access control
export const memberPermissions = pgTable("member_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // References auth.users(id) in Supabase
  companyIds: text("company_ids").array().notNull().default(sql`'{}'::text[]`), // Array of company IDs
  canSeeInventory: boolean("can_see_inventory").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const insertMemberPermissionSchema = createInsertSchema(memberPermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Email = typeof emails.$inferSelect;
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventory.$inferSelect;
export type InsertMemberPermission = z.infer<typeof insertMemberPermissionSchema>;
export type MemberPermission = typeof memberPermissions.$inferSelect;
