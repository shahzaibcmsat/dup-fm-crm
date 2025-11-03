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
