import * as assert from "assert";
import { sanitizeCompletion } from "../../src/completion/parse";
import type { CursorContext } from "../../src/completion/context";

function ctx(overrides: Partial<CursorContext> = {}): CursorContext {
  return {
    filePath: "test.ts",
    languageId: "typescript",
    prefix: "function add(a, b) {\n  return ",
    suffix: "\n}",
    lineBeforeCursor: "  return ",
    prefixLastLine: "  return ",
    ...overrides,
  };
}

suite("sanitizeCompletion", () => {
  test("passes through a plain completion", () => {
    const out = sanitizeCompletion("a + b", ctx(), 64);
    assert.strictEqual(out, "a + b");
  });

  test("strips a fully fenced code block", () => {
    const out = sanitizeCompletion("```ts\na + b\n```", ctx(), 64);
    assert.strictEqual(out, "a + b");
  });

  test("strips a fenced block without language tag", () => {
    const out = sanitizeCompletion("```\na + b\n```", ctx(), 64);
    assert.strictEqual(out, "a + b");
  });

  test("strips an unterminated fence", () => {
    const out = sanitizeCompletion("```\na + b", ctx(), 64);
    assert.strictEqual(out, "a + b");
  });

  test("removes an echo of the line before the cursor", () => {
    const out = sanitizeCompletion("  return a + b", ctx({ lineBeforeCursor: "  return " }), 64);
    assert.strictEqual(out, "a + b");
  });

  test("removes a full-line echo that matches the prefix's last line", () => {
    const c = ctx({
      lineBeforeCursor: "function add(a, b) {",
      prefixLastLine: "function add(a, b) {",
    });
    const out = sanitizeCompletion("function add(a, b) {\n  return a + b", c, 64);
    assert.strictEqual(out, "  return a + b");
  });

  test("cuts at the first double newline", () => {
    const out = sanitizeCompletion("a + b;\n\nconsole.log('extra')", ctx(), 64);
    assert.strictEqual(out, "a + b;");
  });

  test("trims trailing newlines", () => {
    const out = sanitizeCompletion("a + b\n\n", ctx(), 64);
    assert.strictEqual(out, "a + b");
  });

  test("returns empty for empty input", () => {
    assert.strictEqual(sanitizeCompletion("", ctx(), 64), "");
  });

  test("caps length to 4 * maxTokens", () => {
    const long = "x".repeat(500);
    const out = sanitizeCompletion(long, ctx(), 8);
    assert.strictEqual(out.length, 32);
  });
});
