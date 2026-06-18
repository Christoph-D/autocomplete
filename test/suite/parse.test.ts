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

  test("ignores a JSON object whose text field is missing", () => {
    const out = sanitizeCompletion('{"completion": "a + b"}', ctx(), 64);
    assert.strictEqual(out, '{"completion": "a + b"}');
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

  suite("graceful fallback (model ignores JSON mode)", () => {
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

    test("falls back to fence stripping when braces do not parse as JSON", () => {
      const out = sanitizeCompletion("```json\n{not valid json}\n```", ctx(), 64);
      assert.strictEqual(out, "{not valid json}");
    });
  });
});
