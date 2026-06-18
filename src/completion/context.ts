import * as vscode from "vscode";
import type { AutocompleteConfig } from "../config/configuration";

export interface CursorContext {
  filePath: string;
  languageId: string;
  prefix: string;
  suffix: string;
  lineBeforeCursor: string;
  prefixLastLine: string;
}

/**
 * Build the context around the cursor for prompt assembly.
 *
 * - `prefix` is the text from `linesBefore` lines above the cursor up to (and
 *   including) the partial text on the cursor's line before the cursor.
 * - `suffix` is the text from the cursor to `linesAfter` lines below.
 * - The total length of `prefix + suffix` is capped to `maxContextChars`,
 *   truncating the older (bottom) lines of the suffix first, falling back to
 *   the top of the prefix only when the suffix is exhausted.
 */
export function buildContext(
  doc: vscode.TextDocument,
  position: vscode.Position,
  cfg: AutocompleteConfig,
): CursorContext {
  const lineCount = doc.lineCount;
  const startLine = Math.max(0, position.line - cfg.maxContextLinesBefore);
  const endLine = Math.min(lineCount - 1, position.line + cfg.maxContextLinesAfter);

  const prefixStart = new vscode.Position(startLine, 0);
  const prefixEnd = position;
  const suffixStart = position;
  const suffixEnd = new vscode.Position(endLine, doc.lineAt(endLine).text.length);

  let prefix = doc.getText(new vscode.Range(prefixStart, prefixEnd));
  let suffix = doc.getText(new vscode.Range(suffixStart, suffixEnd));

  const lineBeforeCursor = doc.lineAt(position.line).text.slice(0, position.character);

  if (prefix.length + suffix.length > cfg.maxContextChars) {
    const overflow = prefix.length + suffix.length - cfg.maxContextChars;
    if (overflow < suffix.length) {
      suffix = suffix.slice(0, suffix.length - overflow);
      const nl = suffix.lastIndexOf("\n");
      if (nl >= 0) {
        suffix = suffix.slice(0, nl);
      }
    } else {
      suffix = "";
      prefix = prefix.slice(prefix.length - cfg.maxContextChars);
      const nl = prefix.indexOf("\n");
      if (nl >= 0) {
        prefix = prefix.slice(nl + 1);
      }
    }
  }

  const prefixLastLine = prefix.includes("\n")
    ? prefix.slice(prefix.lastIndexOf("\n") + 1)
    : prefix;

  const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
  const filePath = folder
    ? vscode.workspace.asRelativePath(doc.uri)
    : doc.fileName;

  return {
    filePath,
    languageId: doc.languageId,
    prefix,
    suffix,
    lineBeforeCursor,
    prefixLastLine,
  };
}
