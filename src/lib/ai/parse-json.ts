/**
 * Resilient JSON parser for Claude responses.
 * Handles: markdown fences, trailing commas, truncated JSON, embedded text.
 */
export function parseAIJson<T>(raw: string): T {
  // Strip markdown code fences
  let text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Continue to recovery attempts
  }

  // Try extracting JSON object from surrounding text
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {
      // Try fixing truncated JSON
      let candidate = objMatch[0];

      // Remove trailing commas before } or ]
      candidate = candidate.replace(/,\s*([}\]])/g, "$1");

      // Try to close unclosed strings, arrays, objects
      let opens = 0;
      let inString = false;
      let escaped = false;
      for (const ch of candidate) {
        if (escaped) { escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{" || ch === "[") opens++;
        if (ch === "}" || ch === "]") opens--;
      }

      // Close unclosed string
      if (inString) candidate += '"';

      // Close unclosed brackets
      // Count actual opens vs closes
      const braces: string[] = [];
      inString = false;
      escaped = false;
      for (const ch of candidate) {
        if (escaped) { escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{") braces.push("}");
        if (ch === "[") braces.push("]");
        if (ch === "}" || ch === "]") braces.pop();
      }

      // Remove trailing comma before closing
      candidate = candidate.replace(/,\s*$/, "");
      candidate += braces.reverse().join("");

      try {
        return JSON.parse(candidate);
      } catch {
        // Last resort: throw with context
      }
    }
  }

  throw new Error(`Failed to parse AI JSON response (length: ${raw.length}): ${raw.slice(0, 200)}...`);
}
