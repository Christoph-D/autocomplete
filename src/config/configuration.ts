import * as vscode from "vscode";
import { DEFAULT_CONFIG } from "./constants";
import {
  CUSTOM_PROVIDER_ID,
  getProvider,
  isCustomProvider,
  presetDisableThinking,
  presetJsonResponse,
  resolveBaseUrl,
  resolveDisableThinking,
  resolveJsonResponse,
  resolveModel,
} from "./providers";

const SECTION = "aiAutocomplete";

export type LogLevel = "off" | "error" | "info" | "trace";

export interface ModelOverride {
  jsonResponse?: boolean;
  disableThinking?: boolean;
}

export type ModelOverrides = Record<string, ModelOverride>;

/**
 * A provider entry in `aiAutocomplete.backend.providers`. Only deviations from
 * the provider's preset belong here (the custom provider, which has no preset,
 * always stores its base URL/active model). `jsonResponse` / `disableThinking`
 * overrides are per-model under `models`.
 */
export interface ProviderEntry {
  baseUrl?: string;
  activeModel?: string;
  models?: ModelOverrides;
}

export type ProviderEntries = Record<string, ProviderEntry>;

/**
 * The `aiAutocomplete.backend` setting: the active provider id plus the
 * remembered per-provider entries.
 */
export interface BackendSetting {
  activeProvider: string;
  providers: ProviderEntries;
}

/**
 * The fields of `AutocompleteConfig` that have a static default. The remaining
 * fields are derived by `readConfig` from the active provider and its backend
 * entry, so they have no entry in `DEFAULT_CONFIG`.
 */
export interface UserFacingDefaults {
  enabled: boolean;
  backend: BackendSetting;
  maxContextLinesBefore: number;
  maxContextLinesAfter: number;
  maxTokens: number;
  temperature: number;
  requestTimeoutMs: number;
  delayMs: number;
  maxContextChars: number;
  logLevel: LogLevel;
}

export interface AutocompleteConfig extends UserFacingDefaults {
  provider: string;
  model: string;
  apiBaseUrl: string;
  jsonResponse: boolean;
  disableThinking: boolean;
}

export function readConfig(): AutocompleteConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const backend = readBackendSetting(cfg);
  const provider = normalizeProvider(backend.activeProvider);
  const entry = backend.providers[provider];
  const model = resolveModel(provider, entry?.activeModel);
  const modelOverride = entry?.models?.[model];
  return {
    enabled: cfg.get<boolean>("enabled", DEFAULT_CONFIG.enabled),
    provider,
    model,
    apiBaseUrl: resolveBaseUrl(provider, entry?.baseUrl),
    backend,
    maxContextLinesBefore: cfg.get<number>("maxContextLinesBefore", DEFAULT_CONFIG.maxContextLinesBefore),
    maxContextLinesAfter: cfg.get<number>("maxContextLinesAfter", DEFAULT_CONFIG.maxContextLinesAfter),
    maxTokens: cfg.get<number>("maxTokens", DEFAULT_CONFIG.maxTokens),
    temperature: cfg.get<number>("temperature", DEFAULT_CONFIG.temperature),
    requestTimeoutMs: cfg.get<number>("requestTimeoutMs", DEFAULT_CONFIG.requestTimeoutMs),
    delayMs: cfg.get<number>("delayMs", DEFAULT_CONFIG.delayMs),
    maxContextChars: cfg.get<number>("maxContextChars", DEFAULT_CONFIG.maxContextChars),
    jsonResponse: resolveJsonResponse(provider, model, modelOverride?.jsonResponse),
    disableThinking: resolveDisableThinking(provider, model, modelOverride?.disableThinking),
    logLevel: cfg.get<LogLevel>("logLevel", DEFAULT_CONFIG.logLevel),
  };
}

export async function setEnabled(value: boolean): Promise<void> {
  await vscode.workspace.getConfiguration(SECTION).update("enabled", value, vscode.ConfigurationTarget.Global);
}

/**
 * Activate `providerId` as the current provider. Per-provider overrides live in
 * `backend.providers` (the single source of truth for model/base URL), so
 * switching only needs to update the active provider id.
 *
 * Returns the provider that is now active so callers can drive follow-up prompts.
 */
export async function switchProvider(providerId: string): Promise<string> {
  const target = normalizeProvider(providerId);
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const setting = readBackendSetting(cfg);
  await cfg.update("backend", { ...setting, activeProvider: target }, vscode.ConfigurationTarget.Global);
  return target;
}

/**
 * Remember `model` as the active model for `providerId`, storing it as an
 * override unless it matches the provider's preset default (in which case the
 * override is dropped).
 */
export async function setProviderModel(providerId: string, model: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const setting = readBackendSetting(cfg);
  const id = normalizeProvider(providerId);
  const value = model === getProvider(id)?.defaultModel ? undefined : model;
  setEntryField(setting.providers, id, "activeModel", value);
  await cfg.update("backend", setting, vscode.ConfigurationTarget.Global);
}

/**
 * Remember `baseUrl` for `providerId`. The custom provider always stores its
 * base URL; built-in providers only store a deviation from their preset.
 */
export async function setProviderBaseUrl(providerId: string, baseUrl: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const setting = readBackendSetting(cfg);
  const id = normalizeProvider(providerId);
  const value = isCustomProvider(id) ? baseUrl : baseUrl === getProvider(id)?.baseUrl ? undefined : baseUrl;
  setEntryField(setting.providers, id, "baseUrl", value);
  await cfg.update("backend", setting, vscode.ConfigurationTarget.Global);
}

function setEntryField(
  entries: ProviderEntries,
  id: string,
  key: "activeModel" | "baseUrl",
  value: string | undefined,
): void {
  if (value) {
    entries[id] = { ...entries[id], [key]: value };
  } else if (entries[id]) {
    delete entries[id][key];
    if (isEmptyEntry(entries[id])) {
      delete entries[id];
    }
  }
}

function isEmptyEntry(entry: ProviderEntry): boolean {
  return (
    entry.baseUrl === undefined &&
    entry.activeModel === undefined &&
    (entry.models === undefined || Object.keys(entry.models).length === 0)
  );
}

function normalizeProvider(id: string | undefined): string {
  return getProvider(id) ? (id as string) : CUSTOM_PROVIDER_ID;
}

/**
 * Parse raw provider entries and keep only genuine overrides: any
 * `baseUrl`/`activeModel` that matches the provider's preset is dropped, as are
 * `jsonResponse`/`disableThinking` values that match their effective (per-model
 * then per-provider) preset default, empty model/entry objects, and malformed
 * entries. This is the single chokepoint that guarantees the setting never
 * persists redundant (non-override) data — including hand-edited input.
 */
export function normalizeBackendProviders(raw: unknown): ProviderEntries {
  if (!isPlainObject(raw)) {
    return {};
  }
  const out: ProviderEntries = {};
  for (const [providerKey, providerValue] of Object.entries(raw)) {
    if (!isPlainObject(providerValue)) {
      continue;
    }
    const entry: ProviderEntry = {};
    const baseUrl = providerValue.baseUrl;
    if (typeof baseUrl === "string" && baseUrl.trim() && !isPresetBaseUrl(providerKey, baseUrl)) {
      entry.baseUrl = baseUrl;
    }
    const activeModel = providerValue.activeModel;
    if (typeof activeModel === "string" && activeModel.trim() && !isPresetModel(providerKey, activeModel)) {
      entry.activeModel = activeModel;
    }
    const models = normalizeModelOverrides(providerKey, providerValue.models);
    if (models && Object.keys(models).length > 0) {
      entry.models = models;
    }
    if (!isEmptyEntry(entry)) {
      out[providerKey] = entry;
    }
  }
  return out;
}

function normalizeModelOverrides(providerKey: string, raw: unknown): ModelOverrides | undefined {
  if (!isPlainObject(raw)) {
    return undefined;
  }
  const preset = getProvider(providerKey);
  const out: ModelOverrides = {};
  for (const [modelKey, modelValue] of Object.entries(raw)) {
    if (!isPlainObject(modelValue)) {
      continue;
    }
    const mo: ModelOverride = {};
    const jsonResponse = modelValue.jsonResponse;
    if (typeof jsonResponse === "boolean" && presetJsonResponse(preset, modelKey) !== jsonResponse) {
      mo.jsonResponse = jsonResponse;
    }
    const disableThinking = modelValue.disableThinking;
    if (typeof disableThinking === "boolean" && presetDisableThinking(preset, modelKey) !== disableThinking) {
      mo.disableThinking = disableThinking;
    }
    if (Object.keys(mo).length > 0) {
      out[modelKey] = mo;
    }
  }
  return out;
}

function isPresetBaseUrl(id: string, value: string): boolean {
  const preset = getProvider(id);
  return !!preset && preset.baseUrl === value.trim();
}

function isPresetModel(id: string, value: string): boolean {
  const preset = getProvider(id);
  return !!preset && preset.defaultModel === value.trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBackendSetting(cfg: vscode.WorkspaceConfiguration): BackendSetting {
  const raw = cfg.get<unknown>("backend");
  if (isPlainObject(raw)) {
    const active = raw.activeProvider;
    return {
      activeProvider: typeof active === "string" && active ? active : DEFAULT_CONFIG.backend.activeProvider,
      providers: normalizeBackendProviders(raw.providers),
    };
  }
  return { ...DEFAULT_CONFIG.backend };
}
