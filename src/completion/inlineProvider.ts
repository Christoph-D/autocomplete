import * as vscode from "vscode";
import { readConfig, type AutocompleteConfig } from "../config/configuration";
import type { SecretStore } from "../config/secrets";
import { buildContext } from "./context";
import { buildMessages, buildRequest } from "./prompt";
import { sanitizeCompletion } from "./parse";
import { LlmError, type LlmClient } from "../llm/client";
import type { Logger } from "../logging/logger";

export interface InlineProviderDeps {
  secrets: SecretStore;
  client: LlmClient;
  logger: Logger;
  onError?: (err: LlmError) => void;
}

/**
 * Inline completion provider that defers debouncing and request supersession
 * to VS Code, honoring the CancellationToken it passes in.
 *
 * VS Code drops any result that resolves after its token is cancelled (see
 * provideInlineCompletions in the VS Code tree), so this provider must respond
 * quickly and abort the HTTP fetch as soon as VS Code signals cancellation.
 * Internal debouncing only widens the cancellation window and is intentionally
 * avoided — VS Code already debounces via its inline-suggest debounce service.
 */
export class InlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  private cachedConfig: AutocompleteConfig = readConfig();

  constructor(private readonly deps: InlineProviderDeps) {}

  refreshConfig(): void {
    this.cachedConfig = readConfig();
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[]> {
    const cfg = this.cachedConfig;
    if (!cfg.enabled && context.triggerKind !== vscode.InlineCompletionTriggerKind.Invoke) {
      return [];
    }
    if (document.uri.scheme !== "file" && document.uri.scheme !== "untitled") {
      return [];
    }
    if (token.isCancellationRequested) {
      return [];
    }

    const apiKey = await this.deps.secrets.getApiKey(cfg.provider);
    if (token.isCancellationRequested) {
      return [];
    }
    if (!apiKey) {
      return [];
    }

    const ctx = buildContext(document, position, cfg);
    const messages = buildMessages(ctx, cfg);
    const userMessage = messages.find((m) => m.role === "user")?.content;
    this.deps.logger.trace(`llm user message: ${JSON.stringify(userMessage)}`);

    // Bridge VS Code's cancellation token to an AbortSignal for the HTTP fetch.
    // This must stay scoped to this request: the listener is disposed in the
    // finally block so cancellation of one request never bleeds into another.
    const controller = new AbortController();
    if (token.isCancellationRequested) {
      controller.abort();
    }
    const cancelSubscription = token.onCancellationRequested(() => {
      controller.abort();
    });

    const startedAt = Date.now();
    try {
      const request = buildRequest(messages, cfg, apiKey);
      const raw = await this.deps.client.complete(request, controller.signal);
      const elapsed = Date.now() - startedAt;
      if (token.isCancellationRequested) {
        this.deps.logger.trace(`discarded superseded response (after response, ${elapsed}ms)`);
        return [];
      }
      this.deps.logger.trace(`llm response: ${JSON.stringify(raw)} (${elapsed}ms)`);
      const text = sanitizeCompletion(raw, ctx, cfg.maxTokens);
      return text ? [new vscode.InlineCompletionItem(text, new vscode.Range(position, position))] : [];
    } catch (err) {
      const elapsed = Date.now() - startedAt;
      if (token.isCancellationRequested) {
        const phase =
          err instanceof LlmError && err.abortedBeforeFetch ? "cancelled before API call" : "cancelled during API call";
        this.deps.logger.trace(`discarded superseded response (${phase}, ${elapsed}ms)`);
        return [];
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.deps.logger.error(`request failed: ${msg} (${elapsed}ms)`);
      if (err instanceof LlmError) {
        this.deps.onError?.(err);
      }
      return [];
    } finally {
      cancelSubscription.dispose();
    }
  }

  dispose(): void {
    // Each request owns its own AbortController and cancellation listener,
    // which are cleaned up when the request settles. VS Code cancels any
    // still-pending tokens on deactivation, aborting the in-flight fetches.
  }
}
