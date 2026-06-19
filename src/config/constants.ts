import type { AutocompleteConfig } from "./configuration";

/**
 * Single source of truth for configuration default values.
 *
 * These mirror the `"default"` declarations in package.json's
 * `contributes.configuration` schema. VS Code returns the package.json default
 * at runtime, so these values are the effective fallbacks for `cfg.get()`.
 */
export const DEFAULT_CONFIG: Readonly<AutocompleteConfig> = {
  enabled: true,
  model: "",
  apiBaseUrl: "https://example.com/v1",
  maxContextLinesBefore: 100,
  maxContextLinesAfter: 50,
  maxTokens: 100,
  temperature: 0.2,
  requestTimeoutMs: 10000,
  delayMs: 500,
  maxContextChars: 10000,
  jsonResponse: true,
  logLevel: "info",
};
