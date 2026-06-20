import * as assert from "assert";
import * as vscode from "vscode";
import { buildContext } from "../../src/completion/context";
import type { AutocompleteConfig } from "../../src/config/configuration";
import { DEFAULT_CONFIG } from "../../src/config/constants";

function cfg(overrides: Partial<AutocompleteConfig> = {}): AutocompleteConfig {
  return {
    ...DEFAULT_CONFIG,
    provider: "custom",
    model: "example-model",
    apiBaseUrl: "",
    jsonResponse: true,
    disableThinking: false,
    maxTokens: 64,
    delayMs: 0,
    maxContextChars: 8000,
    ...overrides,
  };
}

function openDocument(content: string): Thenable<vscode.TextDocument> {
  return vscode.workspace.openTextDocument({
    content,
    language: "typescript",
  });
}

suite("buildContext", () => {
  test("captures prefix and suffix around cursor", async () => {
    const doc = await openDocument("function add(a, b) {\n  return a + b;\n}\n");
    const position = new vscode.Position(1, 9);
    const ctx = buildContext(doc, position, cfg());

    assert.strictEqual(ctx.prefix, "function add(a, b) {\n  return ");
    assert.strictEqual(ctx.suffix, "a + b;\n}\n");
    assert.strictEqual(ctx.lineBeforeCursor, "  return ");
    assert.strictEqual(ctx.languageId, "typescript");
  });

  test("respects linesBefore cap", async () => {
    const lines: string[] = [];
    for (let i = 0; i < 50; i++) {
      lines.push(`// line ${i}`);
    }
    lines.push("target();");
    const doc = await openDocument(lines.join("\n") + "\n");
    const position = new vscode.Position(50, 4);
    const ctx = buildContext(doc, position, cfg({ maxContextLinesBefore: 10 }));

    assert.ok(ctx.prefix.includes("// line 41"), "prefix should include the most recent allowed lines");
    assert.ok(!ctx.prefix.includes("// line 30"), "prefix should not exceed the cap");
    assert.ok(ctx.prefix.endsWith("targ"), "prefix should end at the cursor position");
  });

  test("respects linesAfter cap", async () => {
    const lines = ["start", ...Array.from({ length: 60 }, (_, i) => `// ${i}`)];
    const doc = await openDocument(lines.join("\n") + "\n");
    const position = new vscode.Position(0, 5);
    const ctx = buildContext(doc, position, cfg({ maxContextLinesAfter: 5 }));

    assert.ok(ctx.suffix.includes("// 0"), "suffix should include immediate following lines");
    assert.ok(!ctx.suffix.includes("// 10"), "suffix should not exceed the cap");
  });

  test("respects maxContextChars", async () => {
    const long = "x".repeat(2000);
    const lines = [long, long, "cursor", long, long];
    const doc = await openDocument(lines.join("\n") + "\n");
    const position = new vscode.Position(2, 0);
    const ctx = buildContext(doc, position, cfg({ maxContextChars: 500 }));

    assert.ok(
      ctx.prefix.length + ctx.suffix.length <= 500,
      `prefix+suffix (${ctx.prefix.length}+${ctx.suffix.length}) must be <= cap`,
    );
  });
});
