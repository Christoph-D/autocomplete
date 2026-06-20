import * as assert from "assert";
import { normalizeBackendProviders } from "../../src/config/configuration";
import { CUSTOM_PROVIDER_ID } from "../../src/config/providers";

const MISTRAL_URL = "https://api.mistral.ai/v1";
const MISTRAL_MODEL = "codestral-latest";

suite("normalizeBackendProviders", () => {
  test("drops an activeModel that matches the provider's preset default", () => {
    const out = normalizeBackendProviders({ mistral: { activeModel: MISTRAL_MODEL } });
    assert.deepStrictEqual(out, {});
  });

  test("drops a base URL that matches the provider's preset", () => {
    const out = normalizeBackendProviders({ mistral: { baseUrl: MISTRAL_URL } });
    assert.deepStrictEqual(out, {});
  });

  test("drops a full preset entry, leaving nothing behind", () => {
    const out = normalizeBackendProviders({ mistral: { baseUrl: MISTRAL_URL, activeModel: MISTRAL_MODEL } });
    assert.deepStrictEqual(out, {});
  });

  test("keeps genuine overrides", () => {
    const out = normalizeBackendProviders({
      mistral: { baseUrl: "https://my-mirror/v1", activeModel: "open-codestral" },
    });
    assert.deepStrictEqual(out, { mistral: { baseUrl: "https://my-mirror/v1", activeModel: "open-codestral" } });
  });

  test("keeps a real override alongside a redundant one", () => {
    const out = normalizeBackendProviders({ mistral: { baseUrl: MISTRAL_URL, activeModel: "open-codestral" } });
    assert.deepStrictEqual(out, { mistral: { activeModel: "open-codestral" } });
  });

  test("always keeps the custom provider's base URL and active model (no preset to match)", () => {
    const out = normalizeBackendProviders({
      [CUSTOM_PROVIDER_ID]: { baseUrl: "https://my-llama/v1", activeModel: "llama3" },
    });
    assert.deepStrictEqual(out, { [CUSTOM_PROVIDER_ID]: { baseUrl: "https://my-llama/v1", activeModel: "llama3" } });
  });

  test("drops a per-model jsonResponse that matches the provider preset default (true)", () => {
    const out = normalizeBackendProviders({ mistral: { models: { "open-codestral": { jsonResponse: true } } } });
    assert.deepStrictEqual(out, {});
  });

  test("drops a per-model jsonResponse true for the custom provider too", () => {
    const out = normalizeBackendProviders({ [CUSTOM_PROVIDER_ID]: { models: { llama3: { jsonResponse: true } } } });
    assert.deepStrictEqual(out, {});
  });

  test("keeps a per-model jsonResponse override of false", () => {
    const out = normalizeBackendProviders({ mistral: { models: { "open-codestral": { jsonResponse: false } } } });
    assert.deepStrictEqual(out, { mistral: { models: { "open-codestral": { jsonResponse: false } } } });
  });

  test("keeps a per-model jsonResponse override of false for the custom provider", () => {
    const out = normalizeBackendProviders({ [CUSTOM_PROVIDER_ID]: { models: { llama3: { jsonResponse: false } } } });
    assert.deepStrictEqual(out, { [CUSTOM_PROVIDER_ID]: { models: { llama3: { jsonResponse: false } } } });
  });

  test("keeps per-model jsonResponse false alongside other overrides", () => {
    const out = normalizeBackendProviders({
      mistral: { activeModel: "open-codestral", models: { "open-codestral": { jsonResponse: false } } },
    });
    assert.deepStrictEqual(out, {
      mistral: { activeModel: "open-codestral", models: { "open-codestral": { jsonResponse: false } } },
    });
  });

  test("drops a per-model jsonResponse true while keeping a genuine override on the same model", () => {
    const out = normalizeBackendProviders({
      mistral: { models: { "open-codestral": { jsonResponse: true, disableThinking: true } } },
    });
    assert.deepStrictEqual(out, { mistral: { models: { "open-codestral": { disableThinking: true } } } });
  });

  test("ignores non-boolean per-model jsonResponse values", () => {
    assert.deepStrictEqual(normalizeBackendProviders({ mistral: { models: { m: { jsonResponse: "yes" } } } }), {});
    assert.deepStrictEqual(normalizeBackendProviders({ mistral: { models: { m: { jsonResponse: 1 } } } }), {});
  });

  test("drops a per-model disableThinking that matches the provider's preset default", () => {
    assert.deepStrictEqual(
      normalizeBackendProviders({ deepseek: { models: { "deepseek-v4-flash": { disableThinking: true } } } }),
      {},
    );
    assert.deepStrictEqual(
      normalizeBackendProviders({ zai: { models: { "glm-5.2": { disableThinking: true } } } }),
      {},
    );
    assert.deepStrictEqual(normalizeBackendProviders({ mistral: { models: { m: { disableThinking: false } } } }), {});
  });

  test("keeps a per-model disableThinking override that deviates from the preset", () => {
    assert.deepStrictEqual(
      normalizeBackendProviders({ deepseek: { models: { "deepseek-v4-pro": { disableThinking: false } } } }),
      {
        deepseek: { models: { "deepseek-v4-pro": { disableThinking: false } } },
      },
    );
    assert.deepStrictEqual(normalizeBackendProviders({ mistral: { models: { m: { disableThinking: true } } } }), {
      mistral: { models: { m: { disableThinking: true } } },
    });
    assert.deepStrictEqual(
      normalizeBackendProviders({ [CUSTOM_PROVIDER_ID]: { models: { llama3: { disableThinking: true } } } }),
      { [CUSTOM_PROVIDER_ID]: { models: { llama3: { disableThinking: true } } } },
    );
  });

  test("keeps a per-model disableThinking override alongside other overrides", () => {
    const out = normalizeBackendProviders({
      deepseek: { activeModel: "deepseek-v4-pro", models: { "deepseek-v4-pro": { disableThinking: false } } },
    });
    assert.deepStrictEqual(out, {
      deepseek: { activeModel: "deepseek-v4-pro", models: { "deepseek-v4-pro": { disableThinking: false } } },
    });
  });

  test("drops disableThinking matching preset while keeping a genuine override on the same model", () => {
    const out = normalizeBackendProviders({
      deepseek: { models: { "deepseek-v4-pro": { disableThinking: true, jsonResponse: false } } },
    });
    assert.deepStrictEqual(out, { deepseek: { models: { "deepseek-v4-pro": { jsonResponse: false } } } });
  });

  test("ignores non-boolean per-model disableThinking values", () => {
    assert.deepStrictEqual(normalizeBackendProviders({ deepseek: { models: { m: { disableThinking: "yes" } } } }), {});
    assert.deepStrictEqual(normalizeBackendProviders({ deepseek: { models: { m: { disableThinking: 1 } } } }), {});
  });

  test("prunes an empty models map after stripping redundant values", () => {
    const out = normalizeBackendProviders({ mistral: { models: { m: { jsonResponse: true } } } });
    assert.deepStrictEqual(out, {});
  });

  test("ignores whitespace when comparing against the preset", () => {
    const out = normalizeBackendProviders({ mistral: { activeModel: `  ${MISTRAL_MODEL}  ` } });
    assert.deepStrictEqual(out, {});
  });

  test("preserves unknown provider ids rather than discarding their data", () => {
    const out = normalizeBackendProviders({ mystery: { baseUrl: "https://x/v1", activeModel: "y" } });
    assert.deepStrictEqual(out, { mystery: { baseUrl: "https://x/v1", activeModel: "y" } });
  });

  test("returns empty for malformed input", () => {
    assert.deepStrictEqual(normalizeBackendProviders(undefined), {});
    assert.deepStrictEqual(normalizeBackendProviders(null), {});
    assert.deepStrictEqual(normalizeBackendProviders([]), {});
    assert.deepStrictEqual(normalizeBackendProviders("nope"), {});
    assert.deepStrictEqual(normalizeBackendProviders({ mistral: "not-an-object" }), {});
    assert.deepStrictEqual(normalizeBackendProviders({ mistral: { baseUrl: "   ", activeModel: "" } }), {});
    assert.deepStrictEqual(normalizeBackendProviders({ mistral: { models: "nope" } }), {});
    assert.deepStrictEqual(normalizeBackendProviders({ mistral: { models: { m: "nope" } } }), {});
  });
});
