import * as assert from "assert";
import { normalizeProfiles } from "../../src/config/configuration";
import { CUSTOM_PROVIDER_ID } from "../../src/config/providers";

const MISTRAL_URL = "https://api.mistral.ai/v1";
const MISTRAL_MODEL = "codestral-latest";

suite("normalizeProfiles", () => {
  test("drops a model that matches the provider's preset default", () => {
    const out = normalizeProfiles({ mistral: { model: MISTRAL_MODEL } });
    assert.deepStrictEqual(out, {});
  });

  test("drops a base URL that matches the provider's preset", () => {
    const out = normalizeProfiles({ mistral: { baseUrl: MISTRAL_URL } });
    assert.deepStrictEqual(out, {});
  });

  test("drops a full preset entry, leaving nothing behind", () => {
    const out = normalizeProfiles({ mistral: { baseUrl: MISTRAL_URL, model: MISTRAL_MODEL } });
    assert.deepStrictEqual(out, {});
  });

  test("keeps genuine overrides", () => {
    const out = normalizeProfiles({
      mistral: { baseUrl: "https://my-mirror/v1", model: "open-codestral" },
    });
    assert.deepStrictEqual(out, { mistral: { baseUrl: "https://my-mirror/v1", model: "open-codestral" } });
  });

  test("keeps a real override alongside a redundant one", () => {
    const out = normalizeProfiles({ mistral: { baseUrl: MISTRAL_URL, model: "open-codestral" } });
    assert.deepStrictEqual(out, { mistral: { model: "open-codestral" } });
  });

  test("always keeps the custom provider's base URL and model (no preset to match)", () => {
    const out = normalizeProfiles({
      [CUSTOM_PROVIDER_ID]: { baseUrl: "https://my-llama/v1", model: "llama3" },
    });
    assert.deepStrictEqual(out, { [CUSTOM_PROVIDER_ID]: { baseUrl: "https://my-llama/v1", model: "llama3" } });
  });

  test("drops a jsonResponse that matches the provider's preset default (true)", () => {
    const out = normalizeProfiles({ mistral: { jsonResponse: true } });
    assert.deepStrictEqual(out, {});
  });

  test("drops jsonResponse true for the custom provider too", () => {
    const out = normalizeProfiles({ [CUSTOM_PROVIDER_ID]: { jsonResponse: true } });
    assert.deepStrictEqual(out, {});
  });

  test("keeps a jsonResponse override of false", () => {
    const out = normalizeProfiles({ mistral: { jsonResponse: false } });
    assert.deepStrictEqual(out, { mistral: { jsonResponse: false } });
  });

  test("keeps a jsonResponse override of false for the custom provider", () => {
    const out = normalizeProfiles({ [CUSTOM_PROVIDER_ID]: { jsonResponse: false } });
    assert.deepStrictEqual(out, { [CUSTOM_PROVIDER_ID]: { jsonResponse: false } });
  });

  test("keeps jsonResponse false alongside other overrides", () => {
    const out = normalizeProfiles({ mistral: { model: "open-codestral", jsonResponse: false } });
    assert.deepStrictEqual(out, { mistral: { model: "open-codestral", jsonResponse: false } });
  });

  test("drops jsonResponse true while keeping a genuine override on the same profile", () => {
    const out = normalizeProfiles({ mistral: { model: "open-codestral", jsonResponse: true } });
    assert.deepStrictEqual(out, { mistral: { model: "open-codestral" } });
  });

  test("ignores non-boolean jsonResponse values", () => {
    assert.deepStrictEqual(normalizeProfiles({ mistral: { jsonResponse: "yes" } }), {});
    assert.deepStrictEqual(normalizeProfiles({ mistral: { jsonResponse: 1 } }), {});
  });

  test("drops a disableThinking that matches the provider's preset default", () => {
    assert.deepStrictEqual(normalizeProfiles({ deepseek: { disableThinking: true } }), {});
    assert.deepStrictEqual(normalizeProfiles({ zai: { disableThinking: true } }), {});
    assert.deepStrictEqual(normalizeProfiles({ mistral: { disableThinking: false } }), {});
  });

  test("keeps a disableThinking override that deviates from the preset", () => {
    assert.deepStrictEqual(normalizeProfiles({ deepseek: { disableThinking: false } }), {
      deepseek: { disableThinking: false },
    });
    assert.deepStrictEqual(normalizeProfiles({ mistral: { disableThinking: true } }), {
      mistral: { disableThinking: true },
    });
    assert.deepStrictEqual(normalizeProfiles({ [CUSTOM_PROVIDER_ID]: { disableThinking: true } }), {
      [CUSTOM_PROVIDER_ID]: { disableThinking: true },
    });
  });

  test("keeps a disableThinking override alongside other overrides", () => {
    const out = normalizeProfiles({ deepseek: { model: "deepseek-v4-pro", disableThinking: false } });
    assert.deepStrictEqual(out, { deepseek: { model: "deepseek-v4-pro", disableThinking: false } });
  });

  test("drops disableThinking matching preset while keeping a genuine override on the same profile", () => {
    const out = normalizeProfiles({ deepseek: { model: "deepseek-v4-pro", disableThinking: true } });
    assert.deepStrictEqual(out, { deepseek: { model: "deepseek-v4-pro" } });
  });

  test("ignores non-boolean disableThinking values", () => {
    assert.deepStrictEqual(normalizeProfiles({ deepseek: { disableThinking: "yes" } }), {});
    assert.deepStrictEqual(normalizeProfiles({ deepseek: { disableThinking: 1 } }), {});
  });

  test("ignores whitespace when comparing against the preset", () => {
    const out = normalizeProfiles({ mistral: { model: `  ${MISTRAL_MODEL}  ` } });
    assert.deepStrictEqual(out, {});
  });

  test("preserves unknown provider ids rather than discarding their data", () => {
    const out = normalizeProfiles({ mystery: { baseUrl: "https://x/v1", model: "y" } });
    assert.deepStrictEqual(out, { mystery: { baseUrl: "https://x/v1", model: "y" } });
  });

  test("returns empty for malformed input", () => {
    assert.deepStrictEqual(normalizeProfiles(undefined), {});
    assert.deepStrictEqual(normalizeProfiles(null), {});
    assert.deepStrictEqual(normalizeProfiles([]), {});
    assert.deepStrictEqual(normalizeProfiles("nope"), {});
    assert.deepStrictEqual(normalizeProfiles({ mistral: "not-an-object" }), {});
    assert.deepStrictEqual(normalizeProfiles({ mistral: { baseUrl: "   ", model: "" } }), {});
  });
});
