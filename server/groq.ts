import Groq from "groq-sdk";
import { getConfig } from "./config-manager";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

// Function to load AI instructions (will be called when needed)
function loadAIInstructions(): string {
  try {
    // Try multiple paths to find ai-instructions.txt
    const possiblePaths = [
      join(__dirname, 'ai-instructions.txt'),           // Same directory as compiled file
      join(process.cwd(), 'server', 'ai-instructions.txt'), // Project root/server
      join(process.cwd(), 'ai-instructions.txt'),        // Project root
    ];
    
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        const instructions = readFileSync(path, 'utf-8');
        console.log('✅ Loaded AI instructions from:', path);
        return instructions;
      }
    }
    
    throw new Error('File not found in any expected location');
  } catch (error) {
    console.warn('⚠️ Could not load ai-instructions.txt, using default instructions');
    return `You are a professional sales representative for FMD Companies, a leading supplier of flooring, doors, and cabinets in Australia.
Be professional, friendly, and helpful in your responses.`;
  }
}

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
  leadSubject?: string;
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
  const model = getConfig('GROQ_MODEL') || "llama-3.1-70b-versatile";
  
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set on the server");
  }

  const groq = new Groq({ apiKey });

  // Build context for AI
  let contextParts: string[] = [];
  
    // Add lead information
    contextParts.push(`Lead Name: ${params.leadName}`);
    contextParts.push(`Lead Email: ${params.leadEmail}`);

    if (params.leadSubject) {
      contextParts.push(`Lead Subject/Inquiry: ${params.leadSubject}`);
    }

    if (params.leadDescription) {
      contextParts.push(`\nLead Description/Notes:\n${params.leadDescription}`);
    }  // Add conversation history if available
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

  // Load AI instructions when generating reply
  const aiInstructions = loadAIInstructions();

  const system =
    "You are a professional business email assistant. Generate email replies in JSON format.\n\n" +
    aiInstructions + "\n\n" +
    "You must respond with ONLY a valid JSON object with this EXACT structure:\n" +
    '{"subject": "email subject line", "body": "email message content"}\n\n' +
    "Email writing guidelines:\n" +
    "- Read the provided lead information and conversation history\n" +
    "- If a draft is provided, incorporate and expand on it\n" +
    "- Address previous questions/concerns if any\n" +
    "- SUBJECT LINE RULES:\n" +
    "  * If there is NO conversation history, this is a FIRST EMAIL - create an appropriate subject WITHOUT 'Re:'\n" +
    "  * If there IS conversation history, this is a REPLY - use 'Re: ' prefix in subject\n" +
    "- Don't include email signatures\n\n" +
    "IMPORTANT: Return ONLY the JSON object. No explanations, no markdown, no extra text.";

  const user = `Context for email reply:\n\n${context}\n\nReturn the JSON response now.`;

  let completion;
  try {
    completion = await groq.chat.completions.create({
      model: model,
      temperature: 0.7,
      max_tokens: 1000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
  } catch (error: any) {
    console.error("Groq API error:", error);
    throw new Error(`Failed to call Groq API: ${error.message}`);
  }

  const content = completion.choices?.[0]?.message?.content?.trim() || "";
  console.log("Groq AI raw response:", content);

  // Try parse as JSON
  let parsed: AutoReplyResult | null = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Try to extract JSON from the response
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try { 
        parsed = JSON.parse(match[0]); 
        console.log("Successfully extracted JSON from response");
      } catch (e) {
        console.error("Failed to parse extracted JSON:", match[0]);
      }
    } else {
      console.error("No JSON object found in response");
    }
  }

  if (!parsed || typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
    console.error("Invalid AI response format. Expected {subject: string, body: string}, got:", parsed);
    throw new Error("AI returned invalid format. Please try again.");
  }

  return { subject: parsed.subject, body: parsed.body };
}
