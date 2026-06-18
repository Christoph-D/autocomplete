import * as vscode from "vscode";

const SECTION = "aiAutocomplete";

export interface AutocompleteConfig {
  enabled: boolean;
  model: string;
  apiBaseUrl: string;
  idleDelayMs: number;
  maxContextLinesBefore: number;
  maxContextLinesAfter: number;
  maxTokens: number;
  temperature: number;
  requestTimeoutMs: number;
  maxContextChars: number;
}

export function readConfig(): AutocompleteConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    enabled: cfg.get<boolean>("enabled", true),
    model: cfg.get<string>("model", ""),
    apiBaseUrl: cfg.get<string>("apiBaseUrl", ""),
    idleDelayMs: cfg.get<number>("idleDelayMs", 150),
    maxContextLinesBefore: cfg.get<number>("maxContextLinesBefore", 100),
    maxContextLinesAfter: cfg.get<number>("maxContextLinesAfter", 50),
    maxTokens: cfg.get<number>("maxTokens", 200),
    temperature: cfg.get<number>("temperature", 0.2),
    requestTimeoutMs: cfg.get<number>("requestTimeoutMs", 10000),
    maxContextChars: cfg.get<number>("maxContextChars", 10000),
  };
}

export async function setEnabled(value: boolean): Promise<void> {
  await vscode.workspace.getConfiguration(SECTION).update("enabled", value, vscode.ConfigurationTarget.Global);
}
