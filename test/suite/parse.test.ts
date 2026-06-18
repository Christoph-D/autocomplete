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
  test("extracts text from a bare JSON object", () => {
    const out = sanitizeCompletion('{"text": "a + b"}', ctx(), 64);
    assert.strictEqual(out, "a + b");
  });

  test("extracts text from a ```json fenced object", () => {
    const raw = "```json\n" + JSON.stringify({ text: "a + b" }) + "\n```";
    const out = sanitizeCompletion(raw, ctx(), 64);
    assert.strictEqual(out, "a + b");
  });

  test("extracts text from JSON embedded in prose", () => {
    const raw = `Sure, here you go:\n${JSON.stringify({ text: "a + b" })}\nDone.`;
    const out = sanitizeCompletion(raw, ctx(), 64);
    assert.strictEqual(out, "a + b");
  });

  test("preserves newlines inside the text field", () => {
    const raw = JSON.stringify({ text: "a + b;\n  return c" });
    const out = sanitizeCompletion(raw, ctx(), 64);
    assert.strictEqual(out, "a + b;\n  return c");
  });

  test("returns empty when JSON text is empty", () => {
    const out = sanitizeCompletion('{"text": ""}', ctx(), 64);
    assert.strictEqual(out, "");
  });

  test("returns empty when JSON text is missing", () => {
    const out = sanitizeCompletion('{"completion": "a + b"}', ctx(), 64);
    assert.strictEqual(out, "");
  });

  test("returns empty when response is not JSON", () => {
    const out = sanitizeCompletion("a + b", ctx(), 64);
    assert.strictEqual(out, "");
  });

  test("returns empty for a fenced code block that is not JSON", () => {
    const out = sanitizeCompletion("```ts\na + b\n```", ctx(), 64);
    assert.strictEqual(out, "");
  });

  test("returns empty when braces do not parse as JSON", () => {
    const out = sanitizeCompletion("```json\n{not valid json}\n```", ctx(), 64);
    assert.strictEqual(out, "");
  });

  test("removes an echo of the line before the cursor", () => {
    const raw = JSON.stringify({ text: "  return a + b" });
    const out = sanitizeCompletion(raw, ctx({ lineBeforeCursor: "  return " }), 64);
    assert.strictEqual(out, "a + b");
  });

  test("trims trailing newlines", () => {
    const raw = JSON.stringify({ text: "a + b\n\n" });
    const out = sanitizeCompletion(raw, ctx(), 64);
    assert.strictEqual(out, "a + b");
  });

  test("caps length to 4 * maxTokens", () => {
    const raw = JSON.stringify({ text: "x".repeat(500) });
    const out = sanitizeCompletion(raw, ctx(), 8);
    assert.strictEqual(out.length, 32);
  });

  test("returns empty for empty input", () => {
    assert.strictEqual(sanitizeCompletion("", ctx(), 64), "");
  });

  test("recovers text from a truncated JSON string", () => {
    const out = sanitizeCompletion('{"text": "a + b', ctx(), 64);
    assert.strictEqual(out, "a + b");
  });

  test("recovers multi-line text from a truncated JSON string", () => {
    const out = sanitizeCompletion('{"text": "a + b;\\n  return c', ctx(), 64);
    assert.strictEqual(out, "a + b;\n  return c");
  });

  test("drops a dangling backslash at the truncation point", () => {
    const out = sanitizeCompletion('{"text": "a + b\\', ctx(), 64);
    assert.strictEqual(out, "a + b");
  });

  test("drops an incomplete unicode escape at the truncation point", () => {
    const out = sanitizeCompletion('{"text": "a + b\\u00', ctx(), 64);
    assert.strictEqual(out, "a + b");
  });

  test("keeps a complete unicode escape before truncation", () => {
    const out = sanitizeCompletion('{"text": "a\\u0041b', ctx(), 64);
    assert.strictEqual(out, "aAb");
  });

  test("handles a truncated string containing an escaped quote", () => {
    const out = sanitizeCompletion('{"text": "a \\"b\\" c', ctx(), 64);
    assert.strictEqual(out, 'a "b" c');
  });

  test("returns empty when truncated payload has no text field", () => {
    const out = sanitizeCompletion('{"completion": "a + b', ctx(), 64);
    assert.strictEqual(out, "");
  });

  test("recovers a truncated string whose body contains a closing brace", () => {
    const raw = '{ "text": "func() {\\n\\treturn x\\n}\\n\\nconst y';
    const out = sanitizeCompletion(raw, ctx(), 64);
    assert.strictEqual(out, "func() {\n\treturn x\n}\n\nconst y");
  });
});
