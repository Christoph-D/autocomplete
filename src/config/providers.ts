/**
 * Built-in provider presets.
 *
 * The active provider's effective `apiBaseUrl`, `model`, `jsonResponse`, and
 * `disableThinking` are resolved from the provider preset together with any
 * per-provider / per-model override stored in `aiAutocomplete.backend.providers`
 * (which also holds the custom provider's base URL).
 *
 * `models` lets a preset refine the `jsonResponse` / `disableThinking` defaults
 * for specific models; entries here take precedence over the provider-level
 * defaults.
 */
export interface ModelPreset {
  jsonResponse?: boolean;
  disableThinking?: boolean;
}

export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  defaultJsonResponse: boolean;
  defaultDisableThinking: boolean;
  /** Per-model refinements of the provider-level defaults. */
  models?: Record<string, ModelPreset>;
  /** Where to sign up for an API key. Shown in prompts. */
  docsUrl?: string;
}

export const CUSTOM_PROVIDER_ID = "custom";

export const PROVIDERS: readonly ProviderPreset[] = [
  {
    id: "mistral",
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "codestral-latest",
    defaultJsonResponse: true,
    defaultDisableThinking: false,
    docsUrl: "https://console.mistral.ai/api-keys",
  },
  {
    id: "zai",
    label: "Z.ai API",
    baseUrl: "https://api.z.ai/api/paas/v4",
    defaultModel: "glm-5.2",
    defaultJsonResponse: true,
    defaultDisableThinking: true,
    docsUrl: "https://z.ai/manage-apikey/apikey-list",
  },
  {
    id: "zai-coding-plan",
    label: "Z.ai Coding Plan",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    defaultModel: "glm-5.2",
    defaultJsonResponse: true,
    defaultDisableThinking: true,
    docsUrl: "https://z.ai/manage-apikey/apikey-list",
  },
  {
    id: "moonshot",
    label: "Moonshot AI",
    baseUrl: "https://api.moonshot.ai/v1",
    defaultModel: "kimi-k2.7-code-highspeed",
    defaultJsonResponse: true,
    defaultDisableThinking: false,
    docsUrl: "https://platform.moonshot.ai",
  },
  {
    id: "deepseek",
    label: "Deepseek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-flash",
    defaultJsonResponse: true,
    defaultDisableThinking: true,
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "",
    defaultJsonResponse: true,
    defaultDisableThinking: false,
    docsUrl: "https://openrouter.ai/keys",
  },
  {
    id: CUSTOM_PROVIDER_ID,
    label: "Custom provider",
    baseUrl: "",
    defaultModel: "",
    defaultJsonResponse: true,
    defaultDisableThinking: false,
  },
];

export function getProvider(id: string | undefined): ProviderPreset | undefined {
  if (!id) {
    return undefined;
  }
  return PROVIDERS.find((p) => p.id === id);
}

export function isCustomProvider(id: string | undefined): boolean {
  return id === CUSTOM_PROVIDER_ID;
}

/**
 * Resolve the base URL for a provider, preferring a remembered override over
 * the preset default. The custom provider has no preset default and relies
 * entirely on a stored override.
 */
export function resolveBaseUrl(id: string, overrideBaseUrl: string | undefined): string {
  const preset = getProvider(id);
  const fromOverride = (overrideBaseUrl ?? "").trim();
  if (fromOverride) {
    return fromOverride;
  }
  return preset?.baseUrl ?? "";
}

/**
 * Resolve the model for a provider, preferring a remembered override over the
 * preset default. Returns empty string when neither is known.
 */
export function resolveModel(id: string, overrideModel: string | undefined): string {
  const preset = getProvider(id);
  const fromOverride = (overrideModel ?? "").trim();
  if (fromOverride) {
    return fromOverride;
  }
  return preset?.defaultModel ?? "";
}

/**
 * Resolve the JSON-response preference, preferring a stored per-model override,
 * then a per-model preset default, then the provider-level preset default.
 * Falls back to `true` for unknown providers so JSON mode stays on by default.
 */
export function resolveJsonResponse(id: string, modelId: string | undefined, override: boolean | undefined): boolean {
  if (typeof override === "boolean") {
    return override;
  }
  return presetJsonResponse(getProvider(id), modelId);
}

/**
 * Resolve the thinking-disabled preference, preferring a stored per-model
 * override, then a per-model preset default, then the provider-level preset
 * default. Falls back to `false` for unknown providers so thinking stays
 * enabled by default.
 */
export function resolveDisableThinking(
  id: string,
  modelId: string | undefined,
  override: boolean | undefined,
): boolean {
  if (typeof override === "boolean") {
    return override;
  }
  return presetDisableThinking(getProvider(id), modelId);
}

/**
 * The effective default `jsonResponse` for `modelId` under `preset`: a
 * per-model preset default wins over the provider-level default. Pure
 * (catalog-independent) so the per-model precedence can be tested directly.
 */
export function presetJsonResponse(preset: ProviderPreset | undefined, modelId: string | undefined): boolean {
  const modelPreset = modelId ? preset?.models?.[modelId] : undefined;
  if (typeof modelPreset?.jsonResponse === "boolean") {
    return modelPreset.jsonResponse;
  }
  return preset?.defaultJsonResponse ?? true;
}

/**
 * The effective default `disableThinking` for `modelId` under `preset`: a
 * per-model preset default wins over the provider-level default. Pure
 * (catalog-independent) so the per-model precedence can be tested directly.
 */
export function presetDisableThinking(preset: ProviderPreset | undefined, modelId: string | undefined): boolean {
  const modelPreset = modelId ? preset?.models?.[modelId] : undefined;
  if (typeof modelPreset?.disableThinking === "boolean") {
    return modelPreset.disableThinking;
  }
  return preset?.defaultDisableThinking ?? false;
}
