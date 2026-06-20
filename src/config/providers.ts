/**
 * Built-in provider presets.
 *
 * The active provider's effective `apiBaseUrl` and `model` are mirrored into the
 * top-level `aiAutocomplete.apiBaseUrl` / `aiAutocomplete.model` settings (so the
 * LLM client and prompt builder stay agnostic). Per-provider overrides — including
 * the custom provider's base URL — are remembered in `aiAutocomplete.providerProfiles`.
 */
export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
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
    docsUrl: "https://console.mistral.ai/api-keys",
  },
  {
    id: "zai",
    label: "Z.ai",
    baseUrl: "https://api.z.ai/api/paas/v4",
    defaultModel: "glm-5.2",
    docsUrl: "https://z.ai/manage-apikey/apikey-list",
  },
  {
    id: "deepseek",
    label: "Deepseek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-flash",
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "",
    docsUrl: "https://openrouter.ai/keys",
  },
  {
    id: CUSTOM_PROVIDER_ID,
    label: "Custom provider",
    baseUrl: "",
    defaultModel: "",
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
