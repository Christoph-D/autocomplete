import type { CursorContext } from "./context";

/**
 * Clean a raw model response into the text that should be inserted at the cursor.
 *
 * The model is asked (via JSON mode) to return an object of the form
 * `{ "text": "..." }`. We extract that field, but degrade gracefully when a
 * model ignores the instruction and returns a fenced code block or raw text.
 *
 * Steps:
 * 1. Extract the completion text: prefer the "text" field of a JSON object;
 *    otherwise fall back to stripping a markdown code fence.
 * 2. Strip a leading re-indent that doesn't match the cursor line's indentation.
 * 3. Remove an echo of the last non-empty line of the prefix.
 * 4. Trim a trailing newline so the suggestion doesn't force a new line.
 * 5. Cap length to 4 * maxTokens chars as a safety net.
 */
export function sanitizeCompletion(raw: string, ctx: CursorContext, maxTokens: number): string {
  if (!raw) {
    return "";
  }

  let text = extractCompletionText(raw);

  const indentMatch = /^\s*/.exec(ctx.lineBeforeCursor);
  const cursorIndent = indentMatch ? indentMatch[0] : "";
  const firstLineEnd = text.indexOf("\n");
  const firstLine = firstLineEnd >= 0 ? text.slice(0, firstLineEnd) : text;

  if (ctx.lineBeforeCursor.length > 0 && firstLine.startsWith(ctx.lineBeforeCursor)) {
    text = text.slice(ctx.lineBeforeCursor.length);
  } else if (ctx.lineBeforeCursor.length > 0 && firstLine.trimEnd() === ctx.lineBeforeCursor.trimEnd()) {
    text = firstLineEnd >= 0 ? text.slice(firstLineEnd + 1) : "";
  }

  if (cursorIndent.length > 0 && text.length > 0) {
    const indent = /^\s*/;
    const lines = text.split("\n");
    const firstNonEmpty = lines.findIndex((l) => l.trim().length > 0);
    if (firstNonEmpty >= 0) {
      const lineIndent = lines[firstNonEmpty].match(indent)?.[0] ?? "";
      if (lineIndent.length > cursorIndent.length && lineIndent.startsWith(cursorIndent)) {
        lines[firstNonEmpty] = lines[firstNonEmpty].slice(cursorIndent.length);
      }
    }
    text = lines.join("\n");
  }

  text = text.replace(/\n+$/g, "");

  const cap = Math.max(1, maxTokens) * 4;
  if (text.length > cap) {
    text = text.slice(0, cap);
  }

  return text;
}

/**
 * Pull the completion string out of a raw model response.
 *
 * Tries, in order:
 *   1. A JSON object (possibly wrapped in a ```json fence or surrounded by
 *      prose) whose `"text"` field is a string.
 *   2. A markdown code fence (graceful fallback for models that ignore the
 *      JSON-mode instruction and echo a fenced block instead).
 *   3. The raw text as-is.
 */
function extractCompletionText(raw: string): string {
  const json = extractJsonObject(raw);
  if (json !== null) {
    try {
      const parsed = JSON.parse(json) as unknown;
      const text = (parsed as { text?: unknown } | null)?.text;
      if (typeof text === "string") {
        return text;
      }
    } catch {
      // Looked like JSON but did not parse; fall through to fence stripping.
    }
  }
  return stripCodeFence(raw);
}

/**
 * Find a JSON object substring within the raw response.
 *
 * Handles a bare object, an object wrapped in a ``` (json) fence, and an
 * object embedded in surrounding prose by taking the first `{` and the last
 * `}`. Returns the substring (inclusive of the braces), or null when no
 * plausible object is present.
 */
function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return null;
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.replace(/\n```\n```/, "\n```");
  const match = /^```[^\n]*\n([\s\S]*?)\n?```\s*$/.exec(trimmed);
  if (match) {
    return match[1];
  }
  const startFence = /^```[^\n]*\n/.exec(trimmed);
  if (startFence) {
    const after = trimmed.slice(startFence[0].length);
    const endIdx = after.indexOf("```");
    return endIdx >= 0 ? after.slice(0, endIdx) : after;
  }
  return trimmed;
}
