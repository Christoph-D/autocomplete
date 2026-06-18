import type { CursorContext } from "./context";

/**
 * Clean a raw model response into the text that should be inserted at the cursor.
 *
 * The model is asked (via JSON mode) to return an object of the form
 * `{ "text": "..." }`. We extract that field. If the response is not a valid
 * such object — whether because there is no JSON, JSON.parse fails, or the
 * parsed value has no string "text" field — we return an empty string so that
 * no suggestion is offered.
 *
 * Steps:
 * 1. Extract the completion text: the "text" field of a JSON object, or "".
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
 * Looks for a JSON object (possibly wrapped in a ```json fence or surrounded by
 * prose) and, if found and parseable, returns its string `"text"` field.
 *
 * When the response was cut off by max_tokens mid-string — so it begins with
 * `{"text":"...` but never reaches a closing quote or brace — we decode the
 * truncated string content directly, dropping any trailing partial escape
 * sequence (e.g. a dangling `\` or an incomplete `\uXX`).
 *
 * Returns an empty string in every other case: no object present, JSON.parse
 * failure, or a parsed value whose `text` is missing or not a string.
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
      return "";
    } catch {
      // The braces did not enclose valid JSON — most likely a string truncated
      // mid-way whose body contained a stray `}`. Fall through and try to
      // recover it as a truncation.
    }
  }
  return extractTruncatedText(raw);
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

/**
 * Recover the `"text"` value from a response that was truncated mid-string.
 *
 * Matches the opening `{"text":"` (allowing arbitrary whitespace, and possibly
 * preceded by a fence or prose) and decodes the remainder as the content of a
 * JSON string that never got its closing quote. A trailing partial escape — a
 * lone backslash or an incomplete `\uXXXX` — is dropped so it does not leak
 * into the suggestion.
 */
function extractTruncatedText(raw: string): string {
  const trimmed = raw.trim();
  const startMatch = /\{\s*"text"\s*:\s*"/.exec(trimmed);
  if (!startMatch) {
    return "";
  }
  const content = trimmed.slice(startMatch.index + startMatch[0].length);
  return decodeJsonStringContent(content);
}

/**
 * Decode the body of a JSON string that may be truncated.
 *
 * The content is everything between the opening quote of the `"text"` value and
 * the cut-off point. JSON.parse does the actual escape decoding once we wrap
 * the body back in quotes; the only thing it cannot tolerate is a trailing
 * partial escape sequence, so `stripTrailingPartialEscape` removes that first.
 * Returns an empty string if the repaired body still fails to parse.
 */
function decodeJsonStringContent(content: string): string {
  const body = stripTrailingPartialEscape(content);
  try {
    return JSON.parse('"' + body + '"') as string;
  } catch {
    return "";
  }
}

/**
 * Drop an incomplete escape sequence from the end of a JSON string body.
 *
 * Truncation can cut an escape in half, leaving either a dangling backslash or
 * a `\uXXXX` with fewer than four hex digits. We locate the last backslash and
 * the run it belongs to: an even-length run is just escaped-backslash pairs
 * (nothing dangling), while an odd-length run means the final backslash opens
 * an escape. That escape is incomplete only when nothing follows it, or when it
 * begins a `\u` that runs out of hex digits before the end of the input.
 */
function stripTrailingPartialEscape(s: string): string {
  let last = s.length - 1;
  while (last >= 0 && s[last] !== "\\") {
    last--;
  }
  if (last < 0) {
    return s;
  }
  let run = 0;
  for (let j = last; j >= 0 && s[j] === "\\"; j--) {
    run++;
  }
  if (run % 2 === 0) {
    return s;
  }
  const tail = s.slice(last + 1);
  if (tail === "" || /^u[0-9a-fA-F]{0,3}$/.test(tail)) {
    return s.slice(0, last);
  }
  return s;
}
