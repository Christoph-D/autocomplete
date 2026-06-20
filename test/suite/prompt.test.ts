import * as assert from "assert";
import { buildMessages, buildRequest } from "../../src/completion/prompt";
import type { CursorContext } from "../../src/completion/context";
import type { AutocompleteConfig } from "../../src/config/configuration";
import { DEFAULT_CONFIG } from "../../src/config/constants";

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
    ...DEFAULT_CONFIG,
    model: "example-model",
    apiBaseUrl: "https://example.com/v1",
    maxTokens: 64,
    delayMs: 0,
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

  test("system prompt requests JSON output", () => {
    const messages = buildMessages(ctx(), cfg());
    const system = messages[0].content;
    assert.ok(/JSON/i.test(system), "system prompt must mention JSON");
    assert.ok(/"text"/.test(system), "system prompt must describe the text field");
    assert.ok(/JSON\.parse/.test(system), "system prompt must require parseable JSON");
    assert.ok(/do not.*prose|no.*prose/i.test(system));
  });

  test("system prompt forbids markdown fences", () => {
    const messages = buildMessages(ctx(), cfg());
    assert.ok(/code fence/i.test(messages[0].content));
  });

  test("user prompt embeds prefix, cursor sentinel, and suffix", () => {
    const messages = buildMessages(ctx(), cfg());
    const user = messages[1].content;
    assert.ok(user.includes("function add(a, b) {"), "prefix missing");
    assert.ok(user.includes("<<<CURSOR>>>"), "sentinel missing");
    assert.ok(user.includes("}\n"), "suffix missing");
  });

  test("user prompt includes path, language, and the JSON shape", () => {
    const messages = buildMessages(ctx(), cfg());
    const user = messages[1].content;
    assert.ok(user.includes("foo.ts"), "file path missing");
    assert.ok(user.includes("typescript"), "language missing");
    assert.ok(/"text"/.test(user), "user prompt must reference the JSON shape");
  });

  test("buildRequest copies config + apiKey and enables JSON mode", () => {
    const messages = buildMessages(ctx(), cfg());
    const req = buildRequest(messages, cfg(), "sk-test");
    assert.strictEqual(req.apiKey, "sk-test");
    assert.strictEqual(req.model, "example-model");
    assert.strictEqual(req.baseUrl, "https://example.com/v1");
    assert.strictEqual(req.messages, messages);
    assert.strictEqual(req.maxTokens, 64);
    assert.strictEqual(req.temperature, 0.2);
    assert.deepStrictEqual(req.responseFormat, { type: "json_object" });
  });

  test("buildRequest omits responseFormat when jsonResponse is disabled", () => {
    const messages = buildMessages(ctx(), cfg());
    const req = buildRequest(messages, { ...cfg(), jsonResponse: false }, "sk-test");
    assert.strictEqual(req.responseFormat, undefined);
  });
});
