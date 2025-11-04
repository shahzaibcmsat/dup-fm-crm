import Groq from "groq-sdk";
import { getConfig } from "./config-manager";

export type GrammarServerResult = {
  text: string;
  suggestions: string[];
};

export async function grammarFix(text: string): Promise<GrammarServerResult> {
  const apiKey = getConfig('GROQ_API_KEY');
  const model = getConfig('GROQ_MODEL') || "llama-3.3-70b-versatile";
  
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set on the server");
  }

  const groq = new Groq({ apiKey });

  const system =
    "You are a concise grammar and clarity editor for business emails. " +
    "Rewrite the user's text with correct grammar, punctuation, and tone while preserving meaning. " +
    "Keep lists and formatting when present. Return compact, natural-sounding text. " +
    "Respond ONLY with JSON: {\"text\": string, \"suggestions\": string[]} where suggestions explains notable changes.";

  const user = `Text to improve:\n\n${text}`;

  const completion = await groq.chat.completions.create({
    model: model,
    temperature: 0.2,
    max_tokens: 600,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const content = completion.choices?.[0]?.message?.content?.trim() || "";

  // Try parse as JSON straight, else extract JSON block
  let parsed: GrammarServerResult | null = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch {}
    }
  }

  if (!parsed || typeof parsed.text !== "string") {
    // Fallback: return original text when parsing fails
    return { text, suggestions: [] };
  }

  // Normalize suggestions
  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions.map((s) => String(s)).filter(Boolean)
    : [];

  return { text: parsed.text, suggestions };
}

export type AutoReplyResult = {
  subject: string;
  body: string;
};

export async function generateAutoReply(params: {
  leadName: string;
  leadEmail: string;
  leadDescription?: string;
  conversationHistory?: Array<{
    direction: 'sent' | 'received';
    subject: string;
    body: string;
    timestamp: string;
  }>;
  currentDraft?: string;
}): Promise<AutoReplyResult> {
  const apiKey = getConfig('GROQ_API_KEY');
  const model = getConfig('GROQ_MODEL') || "llama-3.3-70b-versatile";
  
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set on the server");
  }

  const groq = new Groq({ apiKey });

  // Build context for AI
  let contextParts: string[] = [];
  
  // Add lead information
  contextParts.push(`Lead Name: ${params.leadName}`);
  contextParts.push(`Lead Email: ${params.leadEmail}`);
  
  if (params.leadDescription) {
    contextParts.push(`\nLead Description/Notes:\n${params.leadDescription}`);
  }

  // Add conversation history if available
  if (params.conversationHistory && params.conversationHistory.length > 0) {
    contextParts.push(`\n--- Email Conversation History (oldest to newest) ---`);
    params.conversationHistory.forEach((email, index) => {
      const direction = email.direction === 'sent' ? 'You sent' : `${params.leadName} sent`;
      contextParts.push(`\n[${index + 1}] ${direction} - ${email.subject}`);
      contextParts.push(`${email.body.substring(0, 500)}${email.body.length > 500 ? '...' : ''}`);
    });
  }

  // Add current draft if user has started typing
  if (params.currentDraft && params.currentDraft.trim()) {
    contextParts.push(`\n--- Your Draft So Far ---\n${params.currentDraft}`);
  }

  const context = contextParts.join('\n');

  const system =
    "You are a professional business email assistant. Your task is to generate a well-crafted email reply based on the provided context. " +
    "- Read the lead description and conversation history carefully\n" +
    "- If there's a draft already started, incorporate it and build upon it\n" +
    "- Write a professional, friendly, and helpful response\n" +
    "- Keep the tone conversational but professional\n" +
    "- Be concise and clear\n" +
    "- Address any questions or concerns from previous emails\n" +
    "- If this is the first contact, introduce yourself professionally and address the lead's needs\n" +
    "- Return ONLY valid JSON: {\"subject\": string, \"body\": string}\n" +
    "- The subject should be appropriate (use 'Re: ' prefix if replying to existing conversation)\n" +
    "- The body should be the email content without signatures (user will add their own)";

  const user = `Generate a professional email reply based on this context:\n\n${context}`;

  const completion = await groq.chat.completions.create({
    model: model,
    temperature: 0.7,
    max_tokens: 1000,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const content = completion.choices?.[0]?.message?.content?.trim() || "";

  // Try parse as JSON
  let parsed: AutoReplyResult | null = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch {}
    }
  }

  if (!parsed || typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
    throw new Error("Failed to generate auto-reply. Please try again.");
  }

  return { subject: parsed.subject, body: parsed.body };
}
