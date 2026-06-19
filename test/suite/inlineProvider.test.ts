import * as assert from "assert";
import * as vscode from "vscode";
import { InlineCompletionProvider } from "../../src/completion/inlineProvider";
import { LlmError, type LlmClient } from "../../src/llm/client";
import type { SecretStore } from "../../src/config/secrets";
import { Logger } from "../../src/logging/logger";

function makeSecrets(key = "sk-test"): SecretStore {
  return {
    async getApiKey() {
      return key;
    },
    async setApiKey() {},
    async clearApiKey() {},
    async hasApiKey() {
      return !!key;
    },
  };
}

function makeLogger(): { logger: Logger; lines: string[] } {
  const lines: string[] = [];
  const channel = {
    appendLine(value: string) {
      lines.push(value);
      return value;
    },
    append() {},
    clear() {},
    show() {},
    hide() {},
    dispose() {},
  } as unknown as vscode.OutputChannel;
  const logger = new Logger({ channel, getLevel: () => "trace" });
  return { logger, lines };
}

function recordingClient(): { client: LlmClient; awaitCalled: Promise<AbortSignal> } {
  let resolveCalled!: (s: AbortSignal) => void;
  const awaitCalled = new Promise<AbortSignal>((r) => {
    resolveCalled = r;
  });
  const client: LlmClient = {
    async complete(_req, signal) {
      resolveCalled(signal);
      return new Promise<string>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    },
  };
  return { client, awaitCalled };
}

function lateResponseClient(content: string): { client: LlmClient; awaitCalled: Promise<AbortSignal> } {
  let resolveCalled!: (s: AbortSignal) => void;
  const awaitCalled = new Promise<AbortSignal>((r) => {
    resolveCalled = r;
  });
  const client: LlmClient = {
    async complete(_req, signal) {
      resolveCalled(signal);
      return new Promise<string>((resolve) => {
        signal.addEventListener("abort", () => resolve(content), { once: true });
      });
    },
  };
  return { client, awaitCalled };
}

function immediateClient(content: string): LlmClient {
  return {
    async complete() {
      return content;
    },
  };
}

function errorClient(err: Error): LlmClient {
  return {
    async complete() {
      throw err;
    },
  };
}

function delayAbortClient(): { client: LlmClient; awaitCalled: Promise<AbortSignal> } {
  let resolveCalled!: (s: AbortSignal) => void;
  const awaitCalled = new Promise<AbortSignal>((r) => {
    resolveCalled = r;
  });
  const client: LlmClient = {
    async complete(_req, signal) {
      resolveCalled(signal);
      return new Promise<string>((_resolve, reject) => {
        const onAbort = () => reject(new LlmError("LLM request aborted", undefined, undefined, true));
        if (signal.aborted) {
          onAbort();
        } else {
          signal.addEventListener("abort", onAbort, { once: true });
        }
      });
    },
  };
  return { client, awaitCalled };
}

async function openGoDoc(): Promise<{ doc: vscode.TextDocument; position: vscode.Position }> {
  const content = 'package main\n\nimport (\n\t"fmt"\n)\n\nfunc isOdd\n';
  const doc = await vscode.workspace.openTextDocument({ language: "go", content });
  const position = doc.positionAt(content.indexOf("isOdd") + "isOdd".length);
  return { doc, position };
}

const CTX = {} as vscode.InlineCompletionContext;

suite("InlineCompletionProvider", () => {
  test("resolves with a completion item when the LLM responds", async () => {
    const { logger, lines } = makeLogger();
    const provider = new InlineCompletionProvider({
      secrets: makeSecrets(),
      client: immediateClient('{ "text": "(n int) bool {\\n\\treturn n % 2 == 1\\n}" }'),
      logger,
    });
    const { doc, position } = await openGoDoc();
    const token = new vscode.CancellationTokenSource();
    try {
      const items = await provider.provideInlineCompletionItems(doc, position, CTX, token.token);
      assert.strictEqual(items.length, 1);
      assert.match(items[0].insertText as string, /return n % 2 == 1/);
      assert.ok(!lines.some((l) => l.includes("discarded")));
      assert.ok(!lines.some((l) => l.includes("request failed")));
    } finally {
      provider.dispose();
      token.dispose();
    }
  });

  test("aborts the in-flight fetch when VS Code cancels the token", async () => {
    const { logger, lines } = makeLogger();
    const rec = recordingClient();
    const provider = new InlineCompletionProvider({
      secrets: makeSecrets(),
      client: rec.client,
      logger,
    });
    const { doc, position } = await openGoDoc();
    const token = new vscode.CancellationTokenSource();
    try {
      const promise = provider.provideInlineCompletionItems(doc, position, CTX, token.token);
      const signal = await rec.awaitCalled;
      assert.ok(!signal.aborted);

      token.cancel();
      const items = await promise;

      assert.ok(signal.aborted, "fetch signal must be aborted when VS Code cancels the token");
      assert.deepStrictEqual(items, []);
      assert.ok(lines.some((l) => l.includes("cancelled during API call")));
    } finally {
      provider.dispose();
      token.dispose();
    }
  });

  test("discards a response that lands after the token is cancelled", async () => {
    const { logger, lines } = makeLogger();
    const content = '{ "text": "(n int) bool {\\n\\treturn n % 2 == 1\\n}" }';
    const rec = lateResponseClient(content);
    const provider = new InlineCompletionProvider({
      secrets: makeSecrets(),
      client: rec.client,
      logger,
    });
    const { doc, position } = await openGoDoc();
    const token = new vscode.CancellationTokenSource();
    try {
      const promise = provider.provideInlineCompletionItems(doc, position, CTX, token.token);
      await rec.awaitCalled;

      token.cancel();
      const items = await promise;

      assert.deepStrictEqual(items, []);
      assert.ok(lines.some((l) => l.includes("discarded superseded response")));
    } finally {
      provider.dispose();
      token.dispose();
    }
  });

  test("labels a discard as 'cancelled before API call' when aborted during the delay", async () => {
    const { logger, lines } = makeLogger();
    const rec = delayAbortClient();
    const provider = new InlineCompletionProvider({
      secrets: makeSecrets(),
      client: rec.client,
      logger,
    });
    const { doc, position } = await openGoDoc();
    const token = new vscode.CancellationTokenSource();
    try {
      const promise = provider.provideInlineCompletionItems(doc, position, CTX, token.token);
      await rec.awaitCalled;

      token.cancel();
      const items = await promise;

      assert.deepStrictEqual(items, []);
      assert.ok(lines.some((l) => l.includes("cancelled before API call")));
      assert.ok(!lines.some((l) => l.includes("during API call")));
    } finally {
      provider.dispose();
      token.dispose();
    }
  });

  test("surfaces backend errors via onError and resolves with []", async () => {
    const { logger, lines } = makeLogger();
    let reported: LlmError | undefined;
    const provider = new InlineCompletionProvider({
      secrets: makeSecrets(),
      client: errorClient(new LlmError("LLM request failed: 429 Too Many Requests", 429)),
      logger,
      onError: (err) => {
        reported = err;
      },
    });
    const { doc, position } = await openGoDoc();
    const token = new vscode.CancellationTokenSource();
    try {
      const items = await provider.provideInlineCompletionItems(doc, position, CTX, token.token);

      assert.deepStrictEqual(items, []);
      assert.ok(reported instanceof LlmError, "onError must be called with the LlmError");
      assert.strictEqual(reported?.status, 429);
      assert.ok(lines.some((l) => l.includes("request failed")));
      assert.ok(!lines.some((l) => l.includes("discarded")), "real errors must not be masked as discards");
    } finally {
      provider.dispose();
      token.dispose();
    }
  });
});
