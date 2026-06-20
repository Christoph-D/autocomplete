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
