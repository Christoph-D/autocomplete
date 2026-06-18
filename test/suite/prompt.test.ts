import * as assert from "assert";
import { buildMessages, buildRequest } from "../../src/completion/prompt";
import type { CursorContext } from "../../src/completion/context";
import type { AutocompleteConfig } from "../../src/config/configuration";

function ctx(): CursorContext {
  return {
    filePath: "/x/foo.ts",
    languageId: "typescript",
    prefix: "function add(a, b) {\n  return ",
    suffix: "\n}\n",
    lineBeforeCursor: "  return ",
    prefixLastLine: "  return ",
  };
}

function cfg(): AutocompleteConfig {
  return {
    enabled: true,
    model: "example-model",
    apiBaseUrl: "https://example.com/v1",
    idleDelayMs: 150,
    maxContextLinesBefore: 100,
    maxContextLinesAfter: 50,
    maxTokens: 64,
    temperature: 0.2,
    requestTimeoutMs: 10000,
    maxContextChars: 8000,
  };
}

suite("prompt", () => {
  test("buildMessages returns system + user", () => {
    const messages = buildMessages(ctx(), cfg());
    assert.strictEqual(messages.length, 2);
    assert.strictEqual(messages[0].role, "system");
    assert.strictEqual(messages[1].role, "user");
  });

  test("system prompt forbids prose", () => {
    const messages = buildMessages(ctx(), cfg());
    assert.ok(/ONLY/i.test(messages[0].content));
    assert.ok(/no.*prose|do not.*prose/i.test(messages[0].content));
  });

  test("user prompt embeds prefix, cursor sentinel, and suffix", () => {
    const messages = buildMessages(ctx(), cfg());
    const user = messages[1].content;
    assert.ok(user.includes("function add(a, b) {"), "prefix missing");
    assert.ok(user.includes("<<<CURSOR>>>"), "sentinel missing");
    assert.ok(user.includes("}\n"), "suffix missing");
  });

  test("user prompt includes path and language", () => {
    const messages = buildMessages(ctx(), cfg());
    const user = messages[1].content;
    assert.ok(user.includes("foo.ts"), "file path missing");
    assert.ok(user.includes("typescript"), "language missing");
  });

  test("buildRequest copies config + apiKey", () => {
    const messages = buildMessages(ctx(), cfg());
    const req = buildRequest(messages, cfg(), "sk-test");
    assert.strictEqual(req.apiKey, "sk-test");
    assert.strictEqual(req.model, "example-model");
    assert.strictEqual(req.baseUrl, "https://example.com/v1");
    assert.strictEqual(req.messages, messages);
    assert.strictEqual(req.maxTokens, 64);
    assert.strictEqual(req.temperature, 0.2);
  });
});
