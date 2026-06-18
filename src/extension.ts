import * as vscode from "vscode";
import { createSecretStore, type SecretStore } from "./config/secrets";
import { readConfig, setEnabled } from "./config/configuration";
import { createLlmClient, LlmError, type LlmClient } from "./llm/client";
import { InlineCompletionProvider } from "./completion/inlineProvider";
import { StatusBar, type StatusState } from "./ui/statusBar";

let provider: InlineCompletionProvider | undefined;
let statusBar: StatusBar | undefined;
let disposable: vscode.Disposable | undefined;
let secrets: SecretStore | undefined;
let client: LlmClient | undefined;
let output: vscode.OutputChannel | undefined;
let lastError: { message: string; at: number } | null = null;

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel("AI Autocomplete");
  context.subscriptions.push(output);

  secrets = createSecretStore(context.secrets);
  client = createLlmClient();
  statusBar = new StatusBar();
  context.subscriptions.push(statusBar);

  provider = new InlineCompletionProvider({
    secrets,
    client,
    logger: output,
    onError: (err: LlmError) => handleError(err),
  });

  disposable = vscode.languages.registerInlineCompletionItemProvider(
    [{ scheme: "file" }, { scheme: "untitled" }],
    provider,
  );
  context.subscriptions.push(disposable);

  context.subscriptions.push(
    vscode.commands.registerCommand("aiAutocomplete.setApiKey", () => setApiKeyCommand()),
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

async function refreshStatus(): Promise<void> {
  const cfg = readConfig();
  if (!cfg.enabled) {
    statusBar?.update({ kind: "disabled" });
    return;
  }
  if (secrets && !(await secrets.hasApiKey())) {
    statusBar?.update({ kind: "no-key" });
    return;
  }
  if (lastError && Date.now() - lastError.at < 30_000) {
    statusBar?.update({ kind: "error", message: lastError.message });
    return;
  }
  statusBar?.update({ kind: "ready", model: cfg.model });
}

async function setApiKeyCommand(): Promise<void> {
  const existing = (await secrets?.getApiKey()) ?? "";
  const key = await vscode.window.showInputBox({
    password: true,
    prompt: "Enter your OpenAI-compatible API key (stored securely in the OS keychain).",
    placeHolder: "sk-…",
    value: existing,
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim().length === 0 ? "API key cannot be empty." : null),
  });
  if (key === undefined) {
    return;
  }
  await secrets?.setApiKey(key);
  vscode.window.showInformationMessage("AI Autocomplete: API key saved.");
  lastError = null;
  await refreshStatus();
}

async function clearApiKeyCommand(): Promise<void> {
  await secrets?.clearApiKey();
  vscode.window.showInformationMessage("AI Autocomplete: API key cleared.");
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
  output?.appendLine(`[error] ${err.message}`);
  void refreshStatus();

  if (err.status === 401 || err.status === 403) {
    void vscode.window
      .showWarningMessage(
        "AI Autocomplete: API key rejected by the backend. Update your key?",
        "Set key",
        "Dismiss",
      )
      .then((choice) => {
        if (choice === "Set key") {
          void setApiKeyCommand();
        }
      });
  }
}

export type { StatusState };
