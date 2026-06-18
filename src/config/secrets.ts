import * as vscode from "vscode";

const KEY_ID = "apiKey";

export interface SecretStore {
  getApiKey(): Promise<string | undefined>;
  setApiKey(key: string): Promise<void>;
  clearApiKey(): Promise<void>;
  hasApiKey(): Promise<boolean>;
}

export function createSecretStore(secrets: vscode.SecretStorage): SecretStore {
  return {
    async getApiKey() {
      return secrets.get(KEY_ID);
    },
    async setApiKey(key: string) {
      const trimmed = key.trim();
      if (!trimmed) {
        throw new Error("API key cannot be empty.");
      }
      await secrets.store(KEY_ID, trimmed);
    },
    async clearApiKey() {
      await secrets.delete(KEY_ID);
    },
    async hasApiKey() {
      const v = await secrets.get(KEY_ID);
      return typeof v === "string" && v.length > 0;
    },
  };
}
