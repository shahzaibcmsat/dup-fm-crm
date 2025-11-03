// Groq-powered grammar fix: call server API and return corrected text
export type GrammarResult = {
  text: string;
  suggestions: string[];
};

export async function fixGrammar(text: string): Promise<GrammarResult> {
  const res = await fetch("/api/grammar/fix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    // If server not configured, just return original text
    return { text, suggestions: [] };
  }
  const data = (await res.json()) as GrammarResult;
  if (!data || !data.text) return { text, suggestions: [] };
  // Cap suggestions to a reasonable size for UI
  return { text: data.text, suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 8) : [] };
}
