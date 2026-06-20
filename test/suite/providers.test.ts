import * as assert from "assert";
import {
  CUSTOM_PROVIDER_ID,
  PROVIDERS,
  getProvider,
  isCustomProvider,
  presetDisableThinking,
  presetJsonResponse,
  presetTemperature,
  resolveBaseUrl,
  resolveDisableThinking,
  resolveJsonResponse,
  resolveModel,
  resolveTemperature,
  type ProviderPreset,
} from "../../src/config/providers";

function preset(over: Partial<ProviderPreset> = {}): ProviderPreset {
  return {
    id: "test",
    label: "Test",
    baseUrl: "",
    defaultModel: "",
    defaultTemperature: 0.2,
    defaultJsonResponse: true,
    defaultDisableThinking: false,
    ...over,
  };
}

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

  test("resolveBaseUrl prefers the stored override, then the preset", () => {
    assert.strictEqual(resolveBaseUrl("mistral", undefined), "https://api.mistral.ai/v1");
    assert.strictEqual(resolveBaseUrl("mistral", "https://custom.example/v1"), "https://custom.example/v1");
    assert.strictEqual(resolveBaseUrl(CUSTOM_PROVIDER_ID, undefined), "");
    assert.strictEqual(resolveBaseUrl(CUSTOM_PROVIDER_ID, "https://my-llama/v1"), "https://my-llama/v1");
  });

  test("resolveModel prefers the stored override, then the preset default", () => {
    assert.strictEqual(resolveModel("zai", undefined), "glm-5.2");
    assert.strictEqual(resolveModel("zai", "glm-4.6"), "glm-4.6");
    assert.strictEqual(resolveModel("openrouter", undefined), "");
    assert.strictEqual(resolveModel(CUSTOM_PROVIDER_ID, undefined), "");
  });

  test("every preset defaults temperature to 0.2", () => {
    for (const p of PROVIDERS) {
      assert.strictEqual(p.defaultTemperature, 0.2, `${p.id} should default temperature to 0.2`);
    }
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
});

suite("presetTemperature / presetJsonResponse / presetDisableThinking", () => {
  test("falls back to the provider-level default when no per-model entry exists", () => {
    assert.strictEqual(presetTemperature(preset({ defaultTemperature: 0.2 }), "any"), 0.2);
    assert.strictEqual(presetTemperature(preset({ defaultTemperature: 0.7 }), "any"), 0.7);
    assert.strictEqual(presetJsonResponse(preset({ defaultJsonResponse: true }), "any"), true);
    assert.strictEqual(presetJsonResponse(preset({ defaultJsonResponse: false }), "any"), false);
    assert.strictEqual(presetDisableThinking(preset({ defaultDisableThinking: true }), "any"), true);
    assert.strictEqual(presetDisableThinking(preset({ defaultDisableThinking: false }), "any"), false);
  });

  test("a per-model preset default overrides the provider-level default", () => {
    const p = preset({
      defaultTemperature: 0.2,
      defaultJsonResponse: true,
      defaultDisableThinking: false,
      models: {
        "reasoning-model": { temperature: 0.6, jsonResponse: false, disableThinking: true },
      },
    });
    assert.strictEqual(presetTemperature(p, "reasoning-model"), 0.6);
    assert.strictEqual(presetJsonResponse(p, "reasoning-model"), false);
    assert.strictEqual(presetDisableThinking(p, "reasoning-model"), true);
    assert.strictEqual(presetTemperature(p, "other"), 0.2);
    assert.strictEqual(presetJsonResponse(p, "other"), true);
    assert.strictEqual(presetDisableThinking(p, "other"), false);
  });

  test("a partial per-model entry only overrides the fields it sets", () => {
    const p = preset({
      defaultTemperature: 0.2,
      defaultJsonResponse: true,
      defaultDisableThinking: false,
      models: { m: { disableThinking: true } },
    });
    assert.strictEqual(presetTemperature(p, "m"), 0.2);
    assert.strictEqual(presetJsonResponse(p, "m"), true);
    assert.strictEqual(presetDisableThinking(p, "m"), true);
  });

  test("returns the global fallback for an unknown preset", () => {
    assert.strictEqual(presetTemperature(undefined, "m"), 0.2);
    assert.strictEqual(presetJsonResponse(undefined, "m"), true);
    assert.strictEqual(presetDisableThinking(undefined, "m"), false);
  });

  test("ignores the model id when it is undefined", () => {
    const p = preset({
      defaultTemperature: 0.5,
      defaultJsonResponse: false,
      defaultDisableThinking: true,
      models: { m: { jsonResponse: true } },
    });
    assert.strictEqual(presetTemperature(p, undefined), 0.5);
    assert.strictEqual(presetJsonResponse(p, undefined), false);
    assert.strictEqual(presetDisableThinking(p, undefined), true);
  });
});

suite("resolveTemperature / resolveJsonResponse / resolveDisableThinking", () => {
  test("a stored override wins over preset and per-model defaults", () => {
    assert.strictEqual(resolveTemperature("zai", "glm-5.2", 0.7), 0.7);
    assert.strictEqual(resolveJsonResponse("zai", "glm-5.2", false), false);
    assert.strictEqual(resolveJsonResponse("zai", "glm-5.2", true), true);
    assert.strictEqual(resolveDisableThinking("zai", "glm-5.2", false), false);
    assert.strictEqual(resolveDisableThinking("mistral", "codestral-latest", true), true);
  });

  test("falls back to the provider-level preset default", () => {
    assert.strictEqual(resolveTemperature("zai", undefined, undefined), 0.2);
    assert.strictEqual(resolveTemperature("zai", "glm-5.2", undefined), 0.2);
    assert.strictEqual(resolveJsonResponse("zai", undefined, undefined), true);
    assert.strictEqual(resolveJsonResponse("zai", "glm-5.2", undefined), true);
    assert.strictEqual(resolveDisableThinking("zai", undefined, undefined), true);
    assert.strictEqual(resolveDisableThinking("deepseek", undefined, undefined), true);
    assert.strictEqual(resolveDisableThinking("zai-coding-plan", undefined, undefined), true);
    assert.strictEqual(resolveDisableThinking("mistral", undefined, undefined), false);
    assert.strictEqual(resolveJsonResponse(CUSTOM_PROVIDER_ID, undefined, undefined), true);
    assert.strictEqual(resolveDisableThinking(CUSTOM_PROVIDER_ID, undefined, undefined), false);
    assert.strictEqual(resolveTemperature(CUSTOM_PROVIDER_ID, undefined, undefined), 0.2);
    assert.strictEqual(resolveTemperature("unknown", undefined, undefined), 0.2);
    assert.strictEqual(resolveJsonResponse("unknown", undefined, undefined), true);
    assert.strictEqual(resolveDisableThinking("unknown", undefined, undefined), false);
  });

  test("honours a per-model preset default via the catalog", () => {
    const zai = getProvider("zai")!;
    const withModelDefault: ProviderPreset = {
      ...zai,
      models: { "glm-4.6": { temperature: 0.4, disableThinking: false } },
    };
    assert.strictEqual(presetTemperature(withModelDefault, "glm-4.6"), 0.4);
    assert.strictEqual(presetTemperature(withModelDefault, "glm-5.2"), 0.2);
    assert.strictEqual(presetDisableThinking(withModelDefault, "glm-4.6"), false);
    assert.strictEqual(presetDisableThinking(withModelDefault, "glm-5.2"), true);
  });
});
