import type { UserFacingDefaults } from "./configuration";

/**
 * Single source of truth for configuration default values.
 *
 * These mirror the `"default"` declarations in package.json's
 * `contributes.configuration` schema. VS Code returns the package.json default
 * at runtime, so these values are the effective fallbacks for `cfg.get()`.
 *
 * Only user-facing fields with a static default live here. The derived fields
 * (`provider`, `model`, `apiBaseUrl`, `temperature`, `jsonResponse`,
 * `disableThinking`) are computed by `readConfig` from the active provider and
 * its backend entry, so they have no static default.
 */
export const DEFAULT_CONFIG: Readonly<UserFacingDefaults> = {
  enabled: true,
  backend: { activeProvider: "custom", providers: {} },
  maxContextLinesBefore: 100,
  maxContextLinesAfter: 50,
  maxTokens: 100,
  requestTimeoutMs: 10000,
  delayMs: 500,
  maxContextChars: 10000,
  logLevel: "info",
};
