import * as vscode from "vscode";
import { DEFAULT_CONFIG } from "./constants";

const SECTION = "aiAutocomplete";

export type LogLevel = "off" | "error" | "info" | "trace";

export interface AutocompleteConfig {
  enabled: boolean;
  model: string;
  apiBaseUrl: string;
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
  return {
    enabled: cfg.get<boolean>("enabled", DEFAULT_CONFIG.enabled),
    model: cfg.get<string>("model", DEFAULT_CONFIG.model),
    apiBaseUrl: cfg.get<string>("apiBaseUrl", DEFAULT_CONFIG.apiBaseUrl),
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
