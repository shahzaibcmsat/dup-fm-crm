import { leads, emails, companies, type Lead, type InsertLead, type Email, type InsertEmail, type Company, type InsertCompany } from "@shared/schema";
import { db } from "./db";
import { eq, desc, inArray } from "drizzle-orm";

export type LeadWithCompany = Lead & { company?: Company | null };

export interface IStorage {
  getAllLeads(): Promise<LeadWithCompany[]>;
  getLeadsByCompany(companyId: string): Promise<LeadWithCompany[]>;
  getLead(id: string): Promise<LeadWithCompany | undefined>;
  getLeadByEmail(email: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, lead: InsertLead): Promise<Lead | undefined>;
  updateLeadStatus(id: string, status: string): Promise<Lead | undefined>;
  deleteLead(id: string): Promise<boolean>;
  deleteLeads(ids: string[]): Promise<number>;
  getEmailsByLeadId(leadId: string): Promise<Email[]>;
  getEmailByMessageId(messageId: string): Promise<Email | undefined>;
  createEmail(email: InsertEmail): Promise<Email>;
  createLeads(leadsList: InsertLead[]): Promise<Lead[]>;
  getAllCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, company: InsertCompany): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getAllLeads(): Promise<LeadWithCompany[]> {
    const result = await db
      .select({
        lead: leads,
        company: companies,
      })
      .from(leads)
      .leftJoin(companies, eq(leads.companyId, companies.id))
      .orderBy(desc(leads.createdAt));
    
    return result.map(({ lead, company }) => ({
      ...lead,
      company: company || null,
    }));
  }

  async getLeadsByCompany(companyId: string): Promise<LeadWithCompany[]> {
    const result = await db
      .select({
        lead: leads,
        company: companies,
      })
      .from(leads)
      .leftJoin(companies, eq(leads.companyId, companies.id))
      .where(eq(leads.companyId, companyId))
      .orderBy(desc(leads.createdAt));
    
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

  async getEmailsByLeadId(leadId: string): Promise<Email[]> {
    return await db
      .select()
      .from(emails)
      .where(eq(emails.leadId, leadId))
      .orderBy(desc(emails.sentAt));
  }

  async getEmailByMessageId(messageId: string): Promise<Email | undefined> {
    const [email] = await db.select().from(emails).where(eq(emails.messageId, messageId));
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

  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies).orderBy(companies.name);
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
}

export const storage = new DatabaseStorage();
