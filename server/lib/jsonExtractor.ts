/**
 * Extract fenced ```json ... ``` blocks from unstructured agent text output.
 *
 * Gemini Managed Agents doesn't support structured outputs, so we prompt the agent
 * to emit JSON inside fenced blocks and parse them here.
 */
function sanitizeJsonString(str: string): string {
  return str
    .replace(/:\s*NaN\b/g, ": null")
    .replace(/\[\s*NaN\b/g, "[null")
    .replace(/,\s*NaN\b/g, ", null")
    .replace(/\bNaN\b/g, "null")
    .replace(/\bInfinity\b/g, "null")
    .replace(/\b-Infinity\b/g, "null");
}

export function extractJsonBlocks(text: string): Record<string, unknown>[] {
  const pattern = /```json\s*\n([\s\S]*?)\n\s*```/g;
  const results: Record<string, unknown>[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    try {
      const sanitized = sanitizeJsonString(match[1]);
      const parsed = JSON.parse(sanitized);
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else {
        results.push(parsed);
      }
    } catch {
      // Malformed JSON — skip this block
      continue;
    }
  }
  return results;
}
