import type { CursorContext } from "./context";

/**
 * Clean a raw model response into the text that should be inserted at the cursor.
 *
 * Steps:
 * 1. Extract content from a fenced code block if present.
 * 2. Strip a leading re-indent that doesn't match the cursor line's indentation.
 * 3. Remove an echo of the last non-empty line of the prefix.
 * 4. Trim a trailing newline so the suggestion doesn't force a new line.
 * 5. Cap length to 4 * maxTokens chars as a safety net.
 */
export function sanitizeCompletion(
  raw: string,
  ctx: CursorContext,
  maxTokens: number,
): string {
  if (!raw) {
    return "";
  }

  let text = stripCodeFence(raw);

  const indentMatch = /^\s*/.exec(ctx.lineBeforeCursor);
  const cursorIndent = indentMatch ? indentMatch[0] : "";
  const firstLineEnd = text.indexOf("\n");
  const firstLine = firstLineEnd >= 0 ? text.slice(0, firstLineEnd) : text;

  if (ctx.lineBeforeCursor.length > 0 && firstLine.startsWith(ctx.lineBeforeCursor)) {
    text = text.slice(ctx.lineBeforeCursor.length);
  } else if (
    ctx.lineBeforeCursor.length > 0 &&
    firstLine.trimEnd() === ctx.lineBeforeCursor.trimEnd()
  ) {
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
