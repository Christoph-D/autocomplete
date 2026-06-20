import * as assert from "assert";
import {
  CUSTOM_PROVIDER_ID,
  PROVIDERS,
  getProvider,
  isCustomProvider,
  resolveBaseUrl,
  resolveDisableThinking,
  resolveJsonResponse,
  resolveModel,
} from "../../src/config/providers";

suite("provider catalog", () => {
  test("ids are unique", () => {
    const ids = PROVIDERS.map((p) => p.id);
    assert.deepStrictEqual(ids, [...new Set(ids)]);
  });

  test("includes the expected built-ins and a custom fallback", () => {
    const ids = PROVIDERS.map((p) => p.id);
    for (const expected of ["mistral", "zai", "deepseek", "openrouter", CUSTOM_PROVIDER_ID]) {
      assert.ok(ids.includes(expected), `missing provider ${expected}`);
    }
  });

  test("built-in presets carry base URLs; custom does not", () => {
    for (const p of PROVIDERS) {
      if (isCustomProvider(p.id)) {
        assert.strictEqual(p.baseUrl, "");
      } else {
        assert.ok(p.baseUrl.startsWith("https://"), `${p.id} should have an https base URL`);
      }
    }
  });

  test("getProvider falls back to undefined for unknown ids", () => {
    assert.strictEqual(getProvider("nope"), undefined);
    assert.ok(getProvider("mistral"));
  });

  test("isCustomProvider only matches the custom id", () => {
    assert.strictEqual(isCustomProvider(CUSTOM_PROVIDER_ID), true);
    assert.strictEqual(isCustomProvider("mistral"), false);
    assert.strictEqual(isCustomProvider(undefined), false);
  });

  test("resolveBaseUrl prefers the stored profile, then the preset", () => {
    assert.strictEqual(resolveBaseUrl("mistral", undefined), "https://api.mistral.ai/v1");
    assert.strictEqual(resolveBaseUrl("mistral", "https://custom.example/v1"), "https://custom.example/v1");
    assert.strictEqual(resolveBaseUrl(CUSTOM_PROVIDER_ID, undefined), "");
    assert.strictEqual(resolveBaseUrl(CUSTOM_PROVIDER_ID, "https://my-llama/v1"), "https://my-llama/v1");
  });

  test("resolveModel prefers the stored profile, then the preset default", () => {
    assert.strictEqual(resolveModel("zai", undefined), "glm-5.2");
    assert.strictEqual(resolveModel("zai", "glm-4.6"), "glm-4.6");
    assert.strictEqual(resolveModel("openrouter", undefined), "");
    assert.strictEqual(resolveModel(CUSTOM_PROVIDER_ID, undefined), "");
  });

  test("every preset defaults jsonResponse to true", () => {
    for (const p of PROVIDERS) {
      assert.strictEqual(p.defaultJsonResponse, true, `${p.id} should default jsonResponse to true`);
    }
  });

  test("only deepseek and the z.ai providers default to disabling thinking", () => {
    for (const p of PROVIDERS) {
      const expected = p.id === "deepseek" || p.id === "zai" || p.id === "zai-coding-plan";
      assert.strictEqual(p.defaultDisableThinking, expected, `${p.id} defaultDisableThinking should be ${expected}`);
    }
  });

  test("resolveJsonResponse prefers the stored profile, then the preset default", () => {
    assert.strictEqual(resolveJsonResponse("zai", undefined), true);
    assert.strictEqual(resolveJsonResponse("zai", false), false);
    assert.strictEqual(resolveJsonResponse("zai", true), true);
    assert.strictEqual(resolveJsonResponse(CUSTOM_PROVIDER_ID, undefined), true);
    assert.strictEqual(resolveJsonResponse(CUSTOM_PROVIDER_ID, false), false);
    assert.strictEqual(resolveJsonResponse("unknown", undefined), true);
  });

  test("resolveDisableThinking prefers the stored profile, then the preset default", () => {
    assert.strictEqual(resolveDisableThinking("zai", undefined), true);
    assert.strictEqual(resolveDisableThinking("deepseek", undefined), true);
    assert.strictEqual(resolveDisableThinking("zai-coding-plan", undefined), true);
    assert.strictEqual(resolveDisableThinking("zai", false), false);
    assert.strictEqual(resolveDisableThinking("mistral", undefined), false);
    assert.strictEqual(resolveDisableThinking("mistral", true), true);
    assert.strictEqual(resolveDisableThinking(CUSTOM_PROVIDER_ID, undefined), false);
    assert.strictEqual(resolveDisableThinking(CUSTOM_PROVIDER_ID, true), true);
    assert.strictEqual(resolveDisableThinking("unknown", undefined), false);
  });
});
