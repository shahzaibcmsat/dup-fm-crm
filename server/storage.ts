import { leads, emails, companies, inventory, notifications, type Lead, type InsertLead, type Email, type InsertEmail, type Company, type InsertCompany, type Inventory, type InsertInventory, type Notification, type InsertNotification } from "@shared/schema";
import { db } from "./db";
import { eq, desc, inArray, and, gt, lt } from "drizzle-orm";

export type LeadWithCompany = Lead & { company?: Company | null };

export interface IStorage {
  getAllLeads(limit?: number, cursor?: string): Promise<{ leads: LeadWithCompany[]; nextCursor?: string; hasMore: boolean }>;
  getLeadsByCompany(companyId: string, limit?: number): Promise<LeadWithCompany[]>;
  getLead(id: string): Promise<LeadWithCompany | undefined>;
  getLeadByEmail(email: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, lead: InsertLead): Promise<Lead | undefined>;
  updateLeadStatus(id: string, status: string): Promise<Lead | undefined>;
  updateLeadCompany(id: string, companyId: string | null): Promise<Lead | undefined>;
  updateLeadNotes(id: string, notes: string): Promise<Lead | undefined>;
  deleteLead(id: string): Promise<boolean>;
  deleteLeads(ids: string[]): Promise<number>;
  getEmailsByLeadId(leadId: string, limit?: number, cursor?: string): Promise<{ emails: Email[]; nextCursor?: string; hasMore: boolean }>;
  getEmailByMessageId(messageId: string): Promise<Email | undefined>;
  getEmailByConversationId(conversationId: string): Promise<Email | undefined>;
  createEmail(email: InsertEmail): Promise<Email>;
  createLeads(leadsList: InsertLead[]): Promise<Lead[]>;
  getAllCompanies(limit?: number): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, company: InsertCompany): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<boolean>;
  getAllInventory(limit?: number, cursor?: string): Promise<{ items: Inventory[]; nextCursor?: string; hasMore: boolean }>;
  getInventoryItem(id: string): Promise<Inventory | undefined>;
  createInventoryItem(item: InsertInventory): Promise<Inventory>;
  updateInventoryItem(id: string, item: InsertInventory): Promise<Inventory | undefined>;
  deleteInventoryItem(id: string): Promise<boolean>;
  deleteInventoryItems(ids: string[]): Promise<number>;
  createInventoryItems(items: InsertInventory[]): Promise<Inventory[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  getRecentNotifications(since?: string, limit?: number): Promise<Notification[]>;
  dismissNotification(notificationId: string): Promise<boolean>;
  dismissNotificationsForLead(leadId: string): Promise<number>;
  clearAllNotifications(): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getAllLeads(limit: number = 100, cursor?: string): Promise<{ leads: LeadWithCompany[]; nextCursor?: string; hasMore: boolean }> {
    // Fetch one extra to determine if there are more results
    const fetchLimit = limit + 1;
    
    let query = db
      .select({
        lead: leads,
        company: companies,
      })
      .from(leads)
      .leftJoin(companies, eq(leads.companyId, companies.id))
      .orderBy(desc(leads.createdAt))
      .limit(fetchLimit);
    
    // Apply cursor if provided (cursor is the createdAt timestamp of last item)
    if (cursor) {
      const cursorDate = new Date(cursor);
      query = db
        .select({
          lead: leads,
          company: companies,
        })
        .from(leads)
        .leftJoin(companies, eq(leads.companyId, companies.id))
        .where(lt(leads.createdAt, cursorDate))
        .orderBy(desc(leads.createdAt))
        .limit(fetchLimit);
    }
    
    const result = await query;
    const hasMore = result.length > limit;
    const items = result.slice(0, limit);
    
    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].lead.createdAt.toISOString()
      : undefined;
    
    return {
      leads: items.map(({ lead, company }) => ({
        ...lead,
        company: company || null,
      })),
      nextCursor,
      hasMore
    };
  }

  async getLeadsByCompany(companyId: string, limit: number = 1000): Promise<LeadWithCompany[]> {
    const result = await db
      .select({
        lead: leads,
        company: companies,
      })
      .from(leads)
      .leftJoin(companies, eq(leads.companyId, companies.id))
      .where(eq(leads.companyId, companyId))
      .orderBy(desc(leads.createdAt))
      .limit(limit);
    
    return result.map(({ lead, company }) => ({
      ...lead,
      company: company || null,
    }));
  }

  async getLead(id: string): Promise<LeadWithCompany | undefined> {
    const result = await db
      .select({
        lead: leads,
        company: companies,
      })
      .from(leads)
      .leftJoin(companies, eq(leads.companyId, companies.id))
      .where(eq(leads.id, id));
    
    if (result.length === 0) return undefined;
    
    const { lead, company } = result[0];
    return {
      ...lead,
      company: company || null,
    };
  }

  async getLeadByEmail(email: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.email, email));
    return lead || undefined;
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db
      .insert(leads)
      .values(insertLead)
      .returning();
    return lead;
  }

  async updateLead(id: string, insertLead: InsertLead): Promise<Lead | undefined> {
    const [lead] = await db
      .update(leads)
      .set({ ...insertLead, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return lead || undefined;
  }

  async updateLeadStatus(id: string, status: string): Promise<Lead | undefined> {
    const [lead] = await db
      .update(leads)
      .set({ status, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return lead || undefined;
  }

  async updateLeadCompany(id: string, companyId: string | null): Promise<Lead | undefined> {
    console.log(`💾 Updating lead ${id} with companyId: ${companyId}`);
    const [lead] = await db
      .update(leads)
      .set({ companyId, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    console.log(`💾 Lead updated:`, lead);
    return lead || undefined;
  }

  async updateLeadNotes(id: string, notes: string): Promise<Lead | undefined> {
    const [lead] = await db
      .update(leads)
      .set({ notes, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return lead || undefined;
  }

  async deleteLead(id: string): Promise<boolean> {
    // First delete associated emails
    await db.delete(emails).where(eq(emails.leadId, id));
    
    // Then delete the lead
    const result = await db.delete(leads).where(eq(leads.id, id)).returning();
    return result.length > 0;
  }

  async deleteLeads(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    
    // First delete associated emails for all leads
    await db.delete(emails).where(inArray(emails.leadId, ids));
    
    // Then delete all leads
    const result = await db.delete(leads).where(inArray(leads.id, ids)).returning();
    return result.length;
  }

  async getEmailsByLeadId(leadId: string, limit: number = 50, cursor?: string): Promise<{ emails: Email[]; nextCursor?: string; hasMore: boolean }> {
    const fetchLimit = limit + 1;
    
    let query = db
      .select()
      .from(emails)
      .where(eq(emails.leadId, leadId))
      .orderBy(desc(emails.sentAt))
      .limit(fetchLimit);
    
    if (cursor) {
      const cursorDate = new Date(cursor);
      query = db
        .select()
        .from(emails)
        .where(and(eq(emails.leadId, leadId), lt(emails.sentAt, cursorDate)))
        .orderBy(desc(emails.sentAt))
        .limit(fetchLimit);
    }
    
    const result = await query;
    const hasMore = result.length > limit;
    const items = result.slice(0, limit);
    
    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].sentAt.toISOString()
      : undefined;
    
    return {
      emails: items,
      nextCursor,
      hasMore
    };
  }

  async getEmailByMessageId(messageId: string): Promise<Email | undefined> {
    const [email] = await db.select().from(emails).where(eq(emails.messageId, messageId));
    return email || undefined;
  }

  async getEmailByConversationId(conversationId: string): Promise<Email | undefined> {
    const [email] = await db
      .select()
      .from(emails)
      .where(eq(emails.conversationId, conversationId))
      .orderBy(desc(emails.sentAt))
      .limit(1);
    return email || undefined;
  }

  async createEmail(insertEmail: InsertEmail): Promise<Email> {
    const [email] = await db
      .insert(emails)
      .values(insertEmail)
      .returning();
    return email;
  }

  async createLeads(leadsList: InsertLead[]): Promise<Lead[]> {
    if (leadsList.length === 0) return [];
    return await db.insert(leads).values(leadsList).returning();
  }

  async getAllCompanies(limit: number = 1000): Promise<Company[]> {
    return await db.select().from(companies).orderBy(companies.name).limit(limit);
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const [company] = await db
      .insert(companies)
      .values(insertCompany)
      .returning();
    return company;
  }

  async updateCompany(id: string, insertCompany: InsertCompany): Promise<Company | undefined> {
    const [company] = await db
      .update(companies)
      .set({ ...insertCompany, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return company || undefined;
  }

  async deleteCompany(id: string): Promise<boolean> {
    const result = await db.delete(companies).where(eq(companies.id, id)).returning();
    return result.length > 0;
  }

  async getAllInventory(limit: number = 100, cursor?: string): Promise<{ items: Inventory[]; nextCursor?: string; hasMore: boolean }> {
    const fetchLimit = limit + 1;
    
    let query = db
      .select()
      .from(inventory)
      .orderBy(desc(inventory.createdAt))
      .limit(fetchLimit);
    
    if (cursor) {
      const cursorDate = new Date(cursor);
      query = db
        .select()
        .from(inventory)
        .where(lt(inventory.createdAt, cursorDate))
        .orderBy(desc(inventory.createdAt))
        .limit(fetchLimit);
    }
    
    const result = await query;
    const hasMore = result.length > limit;
    const items = result.slice(0, limit);
    
    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].createdAt.toISOString()
      : undefined;
    
    return {
      items,
      nextCursor,
      hasMore
    };
  }

  async getInventoryItem(id: string): Promise<Inventory | undefined> {
    const [item] = await db.select().from(inventory).where(eq(inventory.id, id));
    return item || undefined;
  }

  async createInventoryItem(insertItem: InsertInventory): Promise<Inventory> {
    const [item] = await db
      .insert(inventory)
      .values(insertItem)
      .returning();
    return item;
  }

  async updateInventoryItem(id: string, insertItem: InsertInventory): Promise<Inventory | undefined> {
    const [item] = await db
      .update(inventory)
      .set({ ...insertItem, updatedAt: new Date() })
      .where(eq(inventory.id, id))
      .returning();
    return item || undefined;
  }

  async deleteInventoryItem(id: string): Promise<boolean> {
    const result = await db.delete(inventory).where(eq(inventory.id, id)).returning();
    return result.length > 0;
  }

  async deleteInventoryItems(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await db.delete(inventory).where(inArray(inventory.id, ids)).returning();
    return result.length;
  }

  async createInventoryItems(items: InsertInventory[]): Promise<Inventory[]> {
    if (items.length === 0) return [];
    return await db.insert(inventory).values(items).returning();
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values(insertNotification)
      .returning();
    return notification;
  }

  async getRecentNotifications(since?: string, limit: number = 100): Promise<Notification[]> {
    let query = db
      .select()
      .from(notifications)
      .where(eq(notifications.dismissed, 0))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    if (since) {
      const sinceDate = new Date(since);
      query = db
        .select()
        .from(notifications)
        .where(and(eq(notifications.dismissed, 0), gt(notifications.createdAt, sinceDate)))
        .orderBy(desc(notifications.createdAt))
        .limit(limit);
    }

    const allNotifications = await query;
    
    // Keep only the latest notification per lead
    const latestByLead = new Map<string, Notification>();
    for (const n of allNotifications) {
      const existing = latestByLead.get(n.leadId);
      if (!existing || new Date(n.createdAt) > new Date(existing.createdAt)) {
        latestByLead.set(n.leadId, n);
      }
    }

    return Array.from(latestByLead.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async dismissNotification(notificationId: string): Promise<boolean> {
    const result = await db
      .update(notifications)
      .set({ dismissed: 1 })
      .where(eq(notifications.id, notificationId))
      .returning();
    return result.length > 0;
  }

  async dismissNotificationsForLead(leadId: string): Promise<number> {
    const result = await db
      .update(notifications)
      .set({ dismissed: 1 })
      .where(eq(notifications.leadId, leadId))
      .returning();
    return result.length;
  }

  async clearAllNotifications(): Promise<boolean> {
    const result = await db
      .update(notifications)
      .set({ dismissed: 1 })
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
