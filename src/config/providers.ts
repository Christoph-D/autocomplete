/**
 * Built-in provider presets.
 *
 * The active provider's effective `apiBaseUrl` and `model` are resolved from
 * the provider preset together with any per-provider override stored in
 * `aiAutocomplete.providers.profiles` (which also holds the custom provider's
 * base URL).
 */
export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  defaultJsonResponse: boolean;
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
    docsUrl: "https://console.mistral.ai/api-keys",
  },
  {
    id: "zai",
    label: "Z.ai",
    baseUrl: "https://api.z.ai/api/paas/v4",
    defaultModel: "glm-5.2",
    defaultJsonResponse: true,
    docsUrl: "https://z.ai/manage-apikey/apikey-list",
  },
  {
    id: "deepseek",
    label: "Deepseek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-flash",
    defaultJsonResponse: true,
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "",
    defaultJsonResponse: true,
    docsUrl: "https://openrouter.ai/keys",
  },
  {
    id: CUSTOM_PROVIDER_ID,
    label: "Custom provider",
    baseUrl: "",
    defaultModel: "",
    defaultJsonResponse: true,
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
 * Resolve the base URL for a provider, preferring a remembered profile override
 * over the preset default. The custom provider has no preset default and relies
 * entirely on a stored override.
 */
export function resolveBaseUrl(id: string, profileBaseUrl: string | undefined): string {
  const preset = getProvider(id);
  const fromProfile = (profileBaseUrl ?? "").trim();
  if (fromProfile) {
    return fromProfile;
  }
  return preset?.baseUrl ?? "";
}

/**
 * Resolve the model for a provider, preferring a remembered profile override
 * over the preset default. Returns empty string when neither is known.
 */
export function resolveModel(id: string, profileModel: string | undefined): string {
  const preset = getProvider(id);
  const fromProfile = (profileModel ?? "").trim();
  if (fromProfile) {
    return fromProfile;
  }
  return preset?.defaultModel ?? "";
}

/**
 * Resolve the JSON-response preference for a provider, preferring a remembered
 * profile override over the preset default. Falls back to `true` for unknown
 * providers so JSON mode stays on by default.
 */
export function resolveJsonResponse(id: string, profileValue: boolean | undefined): boolean {
  if (typeof profileValue === "boolean") {
    return profileValue;
  }
  return getProvider(id)?.defaultJsonResponse ?? true;
}
