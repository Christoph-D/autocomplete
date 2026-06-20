import type { AutocompleteConfig } from "./configuration";

/**
 * Single source of truth for configuration default values.
 *
 * These mirror the `"default"` declarations in package.json's
 * `contributes.configuration` schema. VS Code returns the package.json default
 * at runtime, so these values are the effective fallbacks for `cfg.get()`.
 *
 * `model` and `apiBaseUrl` are not user-facing settings; they are derived by
 * `readConfig` from the active provider and its profile. Both are empty for the
 * default `custom` provider with no profile. `jsonResponse` is likewise derived
 * from the active provider's profile; it defaults to `true` for every provider.
 */
export const DEFAULT_CONFIG: Readonly<AutocompleteConfig> = {
  enabled: true,
  provider: "custom",
  model: "",
  apiBaseUrl: "",
  providers: { activeProvider: "custom", profiles: {} },
  maxContextLinesBefore: 100,
  maxContextLinesAfter: 50,
  maxTokens: 100,
  temperature: 0.2,
  requestTimeoutMs: 10000,
  delayMs: 500,
  maxContextChars: 10000,
  jsonResponse: true,
  disableThinking: false,
  logLevel: "info",
};
