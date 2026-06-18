import * as assert from "assert";
import * as vscode from "vscode";
import { InlineCompletionProvider } from "../../src/completion/inlineProvider";
import type { LlmClient } from "../../src/llm/client";
import type { SecretStore } from "../../src/config/secrets";

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

function makeLogger(): { channel: vscode.OutputChannel; lines: string[] } {
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
  return { channel, lines };
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

async function openGoDoc(): Promise<{ doc: vscode.TextDocument; position: vscode.Position }> {
  const content = 'package main\n\nimport (\n\t"fmt"\n)\n\nfunc isOdd\n';
  const doc = await vscode.workspace.openTextDocument({ language: "go", content });
  const position = doc.positionAt(content.indexOf("isOdd") + "isOdd".length);
  return { doc, position };
}

const CTX = {} as vscode.InlineCompletionContext;

suite("InlineCompletionProvider", () => {
  suiteSetup(async () => {
    await vscode.workspace
      .getConfiguration("aiAutocomplete")
      .update("idleDelayMs", 10, vscode.ConfigurationTarget.Global);
  });

  test("resolves with a completion item when the LLM responds", async () => {
    const { channel, lines } = makeLogger();
    const provider = new InlineCompletionProvider({
      secrets: makeSecrets(),
      client: immediateClient('{ "text": "(n int) bool {\\n\\treturn n % 2 == 1\\n}" }'),
      logger: channel,
    });
    const { doc, position } = await openGoDoc();
    const token = new vscode.CancellationTokenSource();
    try {
      const items = await provider.provideInlineCompletionItems(doc, position, CTX, token.token);
      assert.strictEqual(items.length, 1);
      assert.match(items[0].insertText as string, /return n % 2 == 1/);
      assert.ok(!lines.some((l) => l.includes("discarded")));
    } finally {
      provider.dispose();
      token.dispose();
    }
  });

  test("aborts the in-flight fetch when VS Code cancels the token", async () => {
    const { channel } = makeLogger();
    const rec = recordingClient();
    const provider = new InlineCompletionProvider({
      secrets: makeSecrets(),
      client: rec.client,
      logger: channel,
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
    } finally {
      provider.dispose();
      token.dispose();
    }
  });

  test("superseded request resolves with [] and does not throw", async () => {
    const { channel } = makeLogger();
    const rec = recordingClient();
    const provider = new InlineCompletionProvider({
      secrets: makeSecrets(),
      client: rec.client,
      logger: channel,
    });
    const { doc, position } = await openGoDoc();
    const tokenA = new vscode.CancellationTokenSource();
    const tokenB = new vscode.CancellationTokenSource();
    try {
      const promiseA = provider.provideInlineCompletionItems(doc, position, CTX, tokenA.token);
      await rec.awaitCalled;

      const promiseB = provider.provideInlineCompletionItems(doc, position, CTX, tokenB.token);

      const a = await promiseA;
      assert.deepStrictEqual(a, []);

      tokenB.cancel();
      const b = await promiseB;
      assert.deepStrictEqual(b, []);
    } finally {
      provider.dispose();
      tokenA.dispose();
      tokenB.dispose();
    }
  });

  test("discards a response that lands after the token is cancelled", async () => {
    const { channel, lines } = makeLogger();
    const content = '{ "text": "(n int) bool {\\n\\treturn n % 2 == 1\\n}" }';
    const rec = lateResponseClient(content);
    const provider = new InlineCompletionProvider({
      secrets: makeSecrets(),
      client: rec.client,
      logger: channel,
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
});
