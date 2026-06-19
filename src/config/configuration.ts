import * as vscode from "vscode";

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
    enabled: cfg.get<boolean>("enabled", true),
    model: cfg.get<string>("model", ""),
    apiBaseUrl: cfg.get<string>("apiBaseUrl", ""),
    maxContextLinesBefore: cfg.get<number>("maxContextLinesBefore", 100),
    maxContextLinesAfter: cfg.get<number>("maxContextLinesAfter", 50),
    maxTokens: cfg.get<number>("maxTokens", 200),
    temperature: cfg.get<number>("temperature", 0.2),
    requestTimeoutMs: cfg.get<number>("requestTimeoutMs", 10000),
    delayMs: cfg.get<number>("delayMs", 0),
    maxContextChars: cfg.get<number>("maxContextChars", 10000),
    jsonResponse: cfg.get<boolean>("jsonResponse", true),
    logLevel: cfg.get<LogLevel>("logLevel", "info"),
  };
}

export async function setEnabled(value: boolean): Promise<void> {
  await vscode.workspace.getConfiguration(SECTION).update("enabled", value, vscode.ConfigurationTarget.Global);
}
