import * as vscode from "vscode";
import { readConfig, type AutocompleteConfig } from "../config/configuration";
import type { SecretStore } from "../config/secrets";
import { buildContext } from "./context";
import { buildMessages, buildRequest } from "./prompt";
import { sanitizeCompletion } from "./parse";
import { createDebouncer } from "./debounce";
import type { LlmClient, LlmError } from "../llm/client";

export interface InlineProviderDeps {
  secrets: SecretStore;
  client: LlmClient;
  logger: vscode.OutputChannel;
  onError?: (err: LlmError) => void;
}

interface PendingRequest {
  document: vscode.TextDocument;
  position: vscode.Position;
  controller: AbortController;
  resolve: (items: vscode.InlineCompletionItem[]) => void;
  settled: boolean;
}

export class InlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  private current: PendingRequest | null = null;
  private readonly debouncer: ReturnType<typeof createDebouncer<PendingRequest>>;
  private cachedConfig: AutocompleteConfig = readConfig();

  constructor(private readonly deps: InlineProviderDeps) {
    this.debouncer = createDebouncer(this.cachedConfig.idleDelayMs, async (req, signal) => {
      await this.run(req, signal);
    });
  }

  refreshConfig(): void {
    this.cachedConfig = readConfig();
    this.debouncer.setDelay(this.cachedConfig.idleDelayMs);
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[]> {
    const cfg = this.cachedConfig;
    if (!cfg.enabled) {
      return [];
    }
    if (document.uri.scheme !== "file" && document.uri.scheme !== "untitled") {
      return [];
    }
    const apiKey = await this.deps.secrets.getApiKey();
    if (!apiKey) {
      return [];
    }

    this.supersedeCurrent();

    const controller = new AbortController();
    const pending: PendingRequest = {
      document,
      position,
      controller,
      resolve: () => {},
      settled: false,
    };
    this.current = pending;

    const promise = new Promise<vscode.InlineCompletionItem[]>((resolve) => {
      pending.resolve = (items) => {
        pending.settled = true;
        resolve(items);
      };
    });

    token.onCancellationRequested(() => {
      if (!pending.settled) {
        controller.abort();
      }
    });

    this.debouncer.run(pending);
    return promise;
  }

  private supersedeCurrent(): void {
    const prev = this.current;
    if (!prev) {
      return;
    }
    prev.controller.abort();
    if (!prev.settled) {
      prev.resolve([]);
    }
    this.current = null;
    this.debouncer.cancel();
  }

  private async run(req: PendingRequest, signal: AbortSignal): Promise<void> {
    const { document, position } = req;
    const cfg = this.cachedConfig;

    if (this.cancelled(req, signal)) {
      this.discard(req, "before request");
      return;
    }

    try {
      const ctx = buildContext(document, position, cfg);
      const messages = buildMessages(ctx, cfg);
      const userMessage = messages.find((m) => m.role === "user")?.content;
      this.deps.logger.appendLine(`[trace] llm user message: ${JSON.stringify(userMessage)}`);
      const apiKey = await this.deps.secrets.getApiKey();
      if (!apiKey) {
        if (!req.settled) {
          req.resolve([]);
        }
        return;
      }
      const request = buildRequest(messages, cfg, apiKey);

      const live = AbortSignal.any([signal, req.controller.signal]);
      const raw = await this.deps.client.complete(request, live);
      this.deps.logger.appendLine(`[trace] llm response: ${JSON.stringify(raw)}`);
      if (this.cancelled(req, signal)) {
        this.discard(req, "after response");
        return;
      }

      const text = sanitizeCompletion(raw, ctx, cfg.maxTokens);
      const items = text ? [new vscode.InlineCompletionItem(text, new vscode.Range(position, position))] : [];
      if (!req.settled) {
        req.resolve(items);
      }
    } catch (err) {
      if (this.cancelled(req, signal)) {
        this.discard(req, "after error");
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.deps.logger.appendLine(`[inline] request failed: ${msg}`);
      if (err instanceof Error && err.name === "LlmError") {
        this.deps.onError?.(err);
      }
      if (!req.settled) {
        req.resolve([]);
      }
    } finally {
      if (this.current === req) {
        this.current = null;
      }
    }
  }

  private cancelled(req: PendingRequest, signal: AbortSignal): boolean {
    return signal.aborted || req.controller.signal.aborted;
  }

  private discard(req: PendingRequest, when: string): void {
    this.deps.logger.appendLine(`[trace] discarded superseded response (${when})`);
    if (!req.settled) {
      req.resolve([]);
    }
  }

  dispose(): void {
    this.debouncer.dispose();
    this.supersedeCurrent();
  }
}
