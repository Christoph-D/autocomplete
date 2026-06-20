import * as vscode from "vscode";

const KEY_PREFIX = "apiKey";

export interface SecretStore {
  getApiKey(providerId: string): Promise<string | undefined>;
  setApiKey(providerId: string, key: string): Promise<void>;
  clearApiKey(providerId: string): Promise<void>;
  hasApiKey(providerId: string): Promise<boolean>;
}

export function createSecretStore(secrets: vscode.SecretStorage): SecretStore {
  const keyFor = (providerId: string) => `${KEY_PREFIX}:${providerId}`;
  return {
    async getApiKey(providerId: string) {
      return secrets.get(keyFor(providerId));
    },
    async setApiKey(providerId: string, key: string) {
      const trimmed = key.trim();
      if (!trimmed) {
        throw new Error("API key cannot be empty.");
      }
      await secrets.store(keyFor(providerId), trimmed);
    },
    async clearApiKey(providerId: string) {
      await secrets.delete(keyFor(providerId));
    },
    async hasApiKey(providerId: string) {
      const v = await secrets.get(keyFor(providerId));
      return typeof v === "string" && v.length > 0;
    },
  };
}
