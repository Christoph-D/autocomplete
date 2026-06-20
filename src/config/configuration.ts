import * as vscode from "vscode";
import { DEFAULT_CONFIG } from "./constants";
import { CUSTOM_PROVIDER_ID, getProvider, isCustomProvider, resolveBaseUrl, resolveModel } from "./providers";

const SECTION = "aiAutocomplete";

export type LogLevel = "off" | "error" | "info" | "trace";

/**
 * Per-provider remembered settings. Stored under `aiAutocomplete.providerProfiles`
 * keyed by provider id. The `custom` provider's base URL lives here too.
 */
export interface ProviderProfile {
  baseUrl?: string;
  model?: string;
}

export type ProviderProfiles = Record<string, ProviderProfile>;

export interface AutocompleteConfig {
  enabled: boolean;
  provider: string;
  model: string;
  apiBaseUrl: string;
  providerProfiles: ProviderProfiles;
  maxContextLinesBefore: number;
  maxContextLinesAfter: number;
  maxTokens: number;
  temperature: number;
  requestTimeoutMs: number;
  delayMs: number;
  maxContextChars: number;
  jsonResponse: boolean;
  logLevel: LogLevel;
}

export function readConfig(): AutocompleteConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const provider = normalizeProvider(cfg.get<string>("provider", DEFAULT_CONFIG.provider));
  return {
    enabled: cfg.get<boolean>("enabled", DEFAULT_CONFIG.enabled),
    provider,
    model: cfg.get<string>("model", DEFAULT_CONFIG.model),
    apiBaseUrl: cfg.get<string>("apiBaseUrl", DEFAULT_CONFIG.apiBaseUrl),
    providerProfiles: readProfiles(cfg.get<unknown>("providerProfiles", DEFAULT_CONFIG.providerProfiles)),
    maxContextLinesBefore: cfg.get<number>("maxContextLinesBefore", DEFAULT_CONFIG.maxContextLinesBefore),
    maxContextLinesAfter: cfg.get<number>("maxContextLinesAfter", DEFAULT_CONFIG.maxContextLinesAfter),
    maxTokens: cfg.get<number>("maxTokens", DEFAULT_CONFIG.maxTokens),
    temperature: cfg.get<number>("temperature", DEFAULT_CONFIG.temperature),
    requestTimeoutMs: cfg.get<number>("requestTimeoutMs", DEFAULT_CONFIG.requestTimeoutMs),
    delayMs: cfg.get<number>("delayMs", DEFAULT_CONFIG.delayMs),
    maxContextChars: cfg.get<number>("maxContextChars", DEFAULT_CONFIG.maxContextChars),
    jsonResponse: cfg.get<boolean>("jsonResponse", DEFAULT_CONFIG.jsonResponse),
    logLevel: cfg.get<LogLevel>("logLevel", DEFAULT_CONFIG.logLevel),
  };
}

export async function setEnabled(value: boolean): Promise<void> {
  await vscode.workspace.getConfiguration(SECTION).update("enabled", value, vscode.ConfigurationTarget.Global);
}

/**
 * Persist the current effective `apiBaseUrl`/`model` into the current provider's
 * profile, then activate `providerId` and load its remembered profile (or preset
 * defaults) back into the effective settings.
 *
 * Returns the provider that is now active so callers can drive follow-up prompts.
 */
export async function switchProvider(providerId: string): Promise<string> {
  const target = normalizeProvider(providerId);
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const profiles = readProfiles(cfg.get<unknown>("providerProfiles", {}));

  const current = normalizeProvider(cfg.get<string>("provider", DEFAULT_CONFIG.provider));
  const currentModel = cfg.get<string>("model", "");
  const currentBaseUrl = cfg.get<string>("apiBaseUrl", "");

  profiles[current] = {
    ...(currentModel ? { model: currentModel } : {}),
    ...(currentBaseUrl && currentBaseUrl !== DEFAULT_CONFIG.apiBaseUrl ? { baseUrl: currentBaseUrl } : {}),
  };

  const nextProfile = profiles[target] ?? {};
  const nextBaseUrl = resolveBaseUrl(target, nextProfile.baseUrl);
  const nextModel = resolveModel(target, nextProfile.model);

  await cfg.update("provider", target, vscode.ConfigurationTarget.Global);
  await cfg.update("apiBaseUrl", nextBaseUrl || DEFAULT_CONFIG.apiBaseUrl, vscode.ConfigurationTarget.Global);
  await cfg.update("model", nextModel, vscode.ConfigurationTarget.Global);
  await cfg.update("providerProfiles", profiles, vscode.ConfigurationTarget.Global);

  return target;
}

/**
 * Persist the current effective `apiBaseUrl`/`model` into the active provider's
 * profile without switching providers. Used after the user edits the custom
 * provider's base URL or any provider's model.
 */
export async function saveActiveProfile(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const current = normalizeProvider(cfg.get<string>("provider", DEFAULT_CONFIG.provider));
  const profiles = readProfiles(cfg.get<unknown>("providerProfiles", {}));

  const model = cfg.get<string>("model", "");
  const baseUrl = cfg.get<string>("apiBaseUrl", "");

  // For built-in providers we only need to remember deviations from the preset;
  // the custom provider needs its base URL stored regardless.
  const preset = getProvider(current);
  const baseUrlToStore = isCustomProvider(current) ? baseUrl : baseUrl === preset?.baseUrl ? undefined : baseUrl;
  const modelToStore = model === preset?.defaultModel ? undefined : model;

  const updated: ProviderProfile = {
    ...(baseUrlToStore ? { baseUrl: baseUrlToStore } : {}),
    ...(modelToStore ? { model: modelToStore } : {}),
  };

  if (Object.keys(updated).length === 0) {
    delete profiles[current];
  } else {
    profiles[current] = updated;
  }
  await cfg.update("providerProfiles", profiles, vscode.ConfigurationTarget.Global);
}

function normalizeProvider(id: string | undefined): string {
  return getProvider(id) ? (id as string) : CUSTOM_PROVIDER_ID;
}

function readProfiles(raw: unknown): ProviderProfiles {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  const out: ProviderProfiles = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      continue;
    }
    const profile: ProviderProfile = {};
    const baseUrl = (value as { baseUrl?: unknown }).baseUrl;
    const model = (value as { model?: unknown }).model;
    if (typeof baseUrl === "string" && baseUrl.trim()) {
      profile.baseUrl = baseUrl;
    }
    if (typeof model === "string" && model.trim()) {
      profile.model = model;
    }
    if (Object.keys(profile).length > 0) {
      out[key] = profile;
    }
  }
  return out;
}
