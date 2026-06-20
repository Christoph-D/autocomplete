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
  const profiles = readProfiles(cfg.get<unknown>("providerProfiles", DEFAULT_CONFIG.providerProfiles));
  const profile = profiles[provider];
  return {
    enabled: cfg.get<boolean>("enabled", DEFAULT_CONFIG.enabled),
    provider,
    model: resolveModel(provider, profile?.model),
    apiBaseUrl: resolveBaseUrl(provider, profile?.baseUrl),
    providerProfiles: profiles,
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
 * Activate `providerId` as the current provider. Per-provider overrides live
 * in `providerProfiles` (the single source of truth for model/base URL), so
 * switching only needs to update the active provider id.
 *
 * Returns the provider that is now active so callers can drive follow-up prompts.
 */
export async function switchProvider(providerId: string): Promise<string> {
  const target = normalizeProvider(providerId);
  await vscode.workspace.getConfiguration(SECTION).update("provider", target, vscode.ConfigurationTarget.Global);
  return target;
}

/**
 * Remember `model` for `providerId`, storing it as a profile override unless it
 * matches the provider's preset default (in which case the override is dropped).
 */
export async function setProviderModel(providerId: string, model: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const profiles = readProfiles(cfg.get<unknown>("providerProfiles", {}));
  const id = normalizeProvider(providerId);
  const value = model === getProvider(id)?.defaultModel ? undefined : model;
  setProfileField(profiles, id, "model", value);
  await cfg.update("providerProfiles", profiles, vscode.ConfigurationTarget.Global);
}

/**
 * Remember `baseUrl` for `providerId`. The custom provider always stores its
 * base URL; built-in providers only store a deviation from their preset.
 */
export async function setProviderBaseUrl(providerId: string, baseUrl: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const profiles = readProfiles(cfg.get<unknown>("providerProfiles", {}));
  const id = normalizeProvider(providerId);
  const value = isCustomProvider(id) ? baseUrl : baseUrl === getProvider(id)?.baseUrl ? undefined : baseUrl;
  setProfileField(profiles, id, "baseUrl", value);
  await cfg.update("providerProfiles", profiles, vscode.ConfigurationTarget.Global);
}

function setProfileField(
  profiles: ProviderProfiles,
  id: string,
  key: "model" | "baseUrl",
  value: string | undefined,
): void {
  if (value) {
    profiles[id] = { ...profiles[id], [key]: value };
  } else if (profiles[id]) {
    delete profiles[id][key];
    if (Object.keys(profiles[id]).length === 0) {
      delete profiles[id];
    }
  }
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
