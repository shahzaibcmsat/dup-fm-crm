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
  canSeeInventory: boolean("can_see_inventory").notNull().default(false),
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
  assignedTo: text("assigned_to"), // User ID this lead is assigned to
  assignedAt: timestamp("assigned_at"), // When the lead was assigned
  assignedBy: text("assigned_by"), // Who assigned the lead (admin ID)
  submissionDate: timestamp("submission_date"), // Date when lead was submitted (from import)
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
  inReplyTo: text("in_reply_to"), // Parent message ID (Message-ID header)
  references: text("references"), // Full chain of Message-IDs for threading
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

export const insertLeadSchema = createInsertSchema(leads)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    submissionDate: z.union([
      z.string().transform((val) => new Date(val)),
      z.date(),
      z.null(),
      z.undefined()
    ]).optional(),
    assignedAt: z.union([
      z.string().transform((val) => new Date(val)),
      z.date(),
      z.null(),
      z.undefined()
    ]).optional(),
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

// Notifications table for email reply alerts
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  leadId: varchar("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  emailId: varchar("email_id").references(() => emails.id, { onDelete: "cascade" }),
  leadName: text("lead_name").notNull(),
  fromEmail: text("from_email").notNull(),
  subject: text("subject").notNull(),
  isDismissed: boolean("is_dismissed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  dismissedAt: timestamp("dismissed_at"),
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

export const insertNotificationSchema = createInsertSchema(notifications);

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
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
