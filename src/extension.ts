import * as vscode from "vscode";
import { createSecretStore, type SecretStore } from "./config/secrets";
import { readConfig, setEnabled, switchProvider, setProviderModel, setProviderBaseUrl } from "./config/configuration";
import { CUSTOM_PROVIDER_ID, getProvider, isCustomProvider, PROVIDERS, resolveModel } from "./config/providers";
import { createLlmClient, LlmError, type LlmClient } from "./llm/client";
import { InlineCompletionProvider } from "./completion/inlineProvider";
import { StatusBar, type StatusState } from "./ui/statusBar";
import { Logger } from "./logging/logger";

let provider: InlineCompletionProvider | undefined;
let statusBar: StatusBar | undefined;
let disposable: vscode.Disposable | undefined;
let secrets: SecretStore | undefined;
let client: LlmClient | undefined;
let output: vscode.OutputChannel | undefined;
let logger: Logger | undefined;
let lastError: { message: string; at: number } | null = null;

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel("AI Autocomplete");
  context.subscriptions.push(output);
  logger = new Logger({ channel: output, getLevel: () => readConfig().logLevel });

  secrets = createSecretStore(context.secrets);
  client = createLlmClient();
  statusBar = new StatusBar();
  context.subscriptions.push(statusBar);

  provider = new InlineCompletionProvider({
    secrets,
    client,
    logger,
    onError: (err: LlmError) => handleError(err),
  });

  disposable = vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, provider);
  context.subscriptions.push(disposable);

  context.subscriptions.push(
    vscode.commands.registerCommand("aiAutocomplete.selectProvider", () => selectProviderCommand()),
    vscode.commands.registerCommand("aiAutocomplete.setApiKey", () => promptApiKey(activeProviderId())),
    vscode.commands.registerCommand("aiAutocomplete.clearApiKey", () => clearApiKeyCommand()),
    vscode.commands.registerCommand("aiAutocomplete.toggleEnabled", () => toggleEnabledCommand()),
    vscode.commands.registerCommand("aiAutocomplete.trigger", () => triggerCommand()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("aiAutocomplete")) {
        provider?.refreshConfig();
        refreshStatus();
      }
    }),
  );

  void refreshStatus();
}

export function deactivate(): void {
  provider?.dispose();
}

function activeProviderId(): string {
  return readConfig().provider;
}

async function refreshStatus(): Promise<void> {
  const cfg = readConfig();
  if (!cfg.enabled) {
    statusBar?.update({ kind: "disabled" });
    return;
  }
  const baseUrlConfigured = Boolean(cfg.apiBaseUrl);
  if (!baseUrlConfigured || !cfg.model) {
    statusBar?.update({ kind: "misconfigured" });
    return;
  }
  if (secrets && !(await secrets.hasApiKey(cfg.provider))) {
    const preset = getProvider(cfg.provider);
    statusBar?.update({ kind: "no-key", provider: preset ?? getProvider(CUSTOM_PROVIDER_ID)! });
    return;
  }
  if (lastError && Date.now() - lastError.at < 30_000) {
    statusBar?.update({ kind: "error", message: lastError.message });
    return;
  }
  const preset = getProvider(cfg.provider);
  statusBar?.update({ kind: "ready", provider: preset ?? getProvider(CUSTOM_PROVIDER_ID)!, model: cfg.model });
}

interface ProviderQuickPickItem extends vscode.QuickPickItem {
  readonly providerId: string;
  readonly action?: "setKey" | "setModel";
}

async function selectProviderCommand(): Promise<void> {
  const cfg = readConfig();
  const activeId = cfg.provider;

  const providerItems: ProviderQuickPickItem[] = [...PROVIDERS]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((p) => {
      const entry = cfg.backend.providers[p.id];
      const model = resolveModel(p.id, entry?.activeModel);
      return {
        label: p.id === activeId ? `$(check) ${p.label}` : p.label,
        description: model,
        providerId: p.id,
      };
    });

  const activePreset = getProvider(activeId);
  const actionItems: ProviderQuickPickItem[] = [
    {
      label: "$(key) Set API key…",
      description: activePreset?.label,
      providerId: activeId,
      action: "setKey",
    },
    {
      label: "$(symbol-property) Change model…",
      description: activePreset?.label,
      providerId: activeId,
      action: "setModel",
    },
  ];

  const items: (vscode.QuickPickItem | ProviderQuickPickItem)[] = [
    ...providerItems,
    { label: "Current provider", kind: vscode.QuickPickItemKind.Separator },
    ...actionItems,
  ];

  const picked = (await vscode.window.showQuickPick(items, {
    placeHolder: `Select a provider (active: ${activePreset?.label ?? activeId})`,
    ignoreFocusOut: true,
  })) as ProviderQuickPickItem | undefined;

  if (!picked) {
    return;
  }

  if (picked.action === "setKey") {
    await promptApiKey(picked.providerId);
    return;
  }
  if (picked.action === "setModel") {
    await promptModel(picked.providerId);
    return;
  }

  const previousId = activeId;
  await switchProvider(picked.providerId);
  const configured = await configureActiveProvider();
  if (!configured) {
    await switchProvider(previousId);
    await refreshStatus();
  }
}

/**
 * After a provider switch (or initial activation), prompt for any missing
 * required configuration: custom base URL, model, and API key.
 *
 * Returns `false` if the user dismissed any of the prompts (so the caller can
 * revert a provider switch), `true` once all required configuration is in
 * place.
 */
async function configureActiveProvider(): Promise<boolean> {
  const id = activeProviderId();

  if (isCustomProvider(id) && !readConfig().apiBaseUrl) {
    if (!(await promptBaseUrl(id))) {
      return false;
    }
  }

  if (!readConfig().model) {
    if (!(await promptModel(id))) {
      return false;
    }
  }

  if (secrets && !(await secrets.hasApiKey(id))) {
    if (!(await promptApiKey(id))) {
      return false;
    }
  }

  await refreshStatus();
  return true;
}

async function promptBaseUrl(providerId: string): Promise<boolean> {
  const preset = getProvider(providerId);
  const value = await vscode.window.showInputBox({
    prompt: `Base URL for ${preset?.label ?? providerId} (OpenAI-compatible, usually ending in /v1).`,
    placeHolder: "https://your-host/v1",
    value: readConfig().apiBaseUrl,
    ignoreFocusOut: true,
    validateInput: (v) => {
      const t = v.trim();
      if (!t) {
        return "Base URL cannot be empty.";
      }
      if (!/^https?:\/\//i.test(t)) {
        return "Enter a URL starting with http:// or https://";
      }
      return null;
    },
  });
  if (value === undefined) {
    return false;
  }
  await setProviderBaseUrl(providerId, value.trim());
  return true;
}

async function promptModel(providerId: string): Promise<boolean> {
  const preset = getProvider(providerId);
  const current = readConfig().model;
  const value = await vscode.window.showInputBox({
    prompt: `Model name for ${preset?.label ?? providerId}.`,
    placeHolder: preset?.defaultModel || "model-name",
    value: current || preset?.defaultModel || "",
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim().length === 0 ? "Model cannot be empty." : null),
  });
  if (value === undefined) {
    return false;
  }
  await setProviderModel(providerId, value.trim());
  return true;
}

async function promptApiKey(providerId: string): Promise<boolean> {
  const preset = getProvider(providerId);
  const existing = (await secrets?.getApiKey(providerId)) ?? "";
  const key = await vscode.window.showInputBox({
    password: true,
    prompt: `Enter the API key for ${preset?.label ?? providerId} (stored securely in the OS keychain).${
      preset?.docsUrl ? ` Get one at ${preset.docsUrl}.` : ""
    }`,
    placeHolder: "sk-…",
    value: existing,
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim().length === 0 ? "API key cannot be empty." : null),
  });
  if (key === undefined) {
    return false;
  }
  await secrets?.setApiKey(providerId, key);
  vscode.window.showInformationMessage(`AI Autocomplete: API key saved for ${preset?.label ?? providerId}.`);
  lastError = null;
  await refreshStatus();
  return true;
}

async function clearApiKeyCommand(): Promise<void> {
  const id = activeProviderId();
  const preset = getProvider(id);
  await secrets?.clearApiKey(id);
  vscode.window.showInformationMessage(`AI Autocomplete: API key cleared for ${preset?.label ?? id}.`);
  await refreshStatus();
}

async function toggleEnabledCommand(): Promise<void> {
  const cfg = readConfig();
  await setEnabled(!cfg.enabled);
}

async function triggerCommand(): Promise<void> {
  await vscode.commands.executeCommand("editor.action.inlineSuggest.trigger");
}

function handleError(err: LlmError): void {
  lastError = { message: err.message, at: Date.now() };
  logger?.error(err.message);
  void refreshStatus();

  if (err.status === 401 || err.status === 403) {
    void vscode.window
      .showWarningMessage("AI Autocomplete: API key rejected by the backend. Update your key?", "Set key", "Dismiss")
      .then((choice) => {
        if (choice === "Set key") {
          void promptApiKey(activeProviderId());
        }
      });
  }
}

export type { StatusState };
