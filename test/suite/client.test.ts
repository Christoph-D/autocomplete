import * as assert from "assert";
import { createLlmClient, LlmError } from "../../src/llm/client";
import type { CompletionRequest } from "../../src/completion/prompt";

function baseRequest(overrides: Partial<CompletionRequest> = {}): CompletionRequest {
  return {
    baseUrl: "https://example.com/v1",
    apiKey: "sk-test",
    model: "example-model",
    messages: [{ role: "user", content: "hi" }],
    maxTokens: 16,
    temperature: 0,
    requestTimeoutMs: 5000,
    ...overrides,
  };
}

function mockFetch(opts: {
  status?: number;
  body?: unknown;
  text?: string;
}): typeof fetch {
  const status = opts.status ?? 200;
  return (async (_url: unknown, _init?: unknown) => {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: opts.status === 401 ? "Unauthorized" : "OK",
      async text() {
        return opts.text ?? "";
      },
      async json() {
        return opts.body ?? {};
      },
    } as unknown as Response;
  }) as typeof fetch;
}

suite("LlmClient", () => {
  test("POSTs to /chat/completions and returns content", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fetchFn = (async (url: unknown, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async text() {
          return "";
        },
        async json() {
          return {
            choices: [{ message: { content: "hello world" } }],
          };
        },
      } as unknown as Response;
    }) as typeof fetch;

    const client = createLlmClient({ fetch: fetchFn });
    const out = await client.complete(baseRequest(), new AbortController().signal);

    assert.strictEqual(out, "hello world");
    assert.ok(capturedUrl.endsWith("/chat/completions"), `url was: ${capturedUrl}`);
    assert.strictEqual(capturedInit?.method, "POST");
    const headers = capturedInit?.headers as Record<string, string>;
    assert.strictEqual(headers["Authorization"], "Bearer sk-test");
    assert.strictEqual(headers["Content-Type"], "application/json");

    const body = JSON.parse(String(capturedInit?.body));
    assert.strictEqual(body.model, "example-model");
    assert.strictEqual(body.stream, false);
    assert.strictEqual(body.max_tokens, 16);
  });

  test("strips trailing slashes from baseUrl", async () => {
    let capturedUrl = "";
    const fetchFn = (async (url: unknown) => {
      capturedUrl = String(url);
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async text() {
          return "";
        },
        async json() {
          return { choices: [{ message: { content: "x" } }] };
        },
      } as unknown as Response;
    }) as typeof fetch;

    const client = createLlmClient({ fetch: fetchFn });
    await client.complete(
      baseRequest({ baseUrl: "https://example.com/v1///" }),
      new AbortController().signal,
    );
    assert.strictEqual(capturedUrl, "https://example.com/v1/chat/completions");
  });

  test("throws LlmError on non-2xx", async () => {
    const client = createLlmClient({
      fetch: mockFetch({ status: 401, text: "bad key" }),
    });
    await assert.rejects(
      () => client.complete(baseRequest(), new AbortController().signal),
      (err: unknown) => err instanceof LlmError && err.status === 401,
    );
  });

  test("throws LlmError on abort", async () => {
    const client = createLlmClient({
      fetch: mockFetch({ status: 200, body: { choices: [] } }),
    });
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      () => client.complete(baseRequest(), controller.signal),
      (err: unknown) => err instanceof LlmError,
    );
  });

  test("returns empty string when content is missing", async () => {
    const client = createLlmClient({
      fetch: mockFetch({ status: 200, body: { choices: [{ message: {} }] } }),
    });
    const out = await client.complete(baseRequest(), new AbortController().signal);
    assert.strictEqual(out, "");
  });

  test("disables thinking when model starts with deepseek", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFn = (async (_url: unknown, init?: RequestInit) => {
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async text() {
          return "";
        },
        async json() {
          return { choices: [{ message: { content: "x" } }] };
        },
      } as unknown as Response;
    }) as typeof fetch;

    const client = createLlmClient({ fetch: fetchFn });
    await client.complete(
      baseRequest({ model: "deepseek-v4-flash" }),
      new AbortController().signal,
    );
    const body = JSON.parse(String(capturedInit?.body));
    assert.deepStrictEqual(body.thinking, { type: "disabled" });
  });

  test("does not set thinking for non-deepseek models", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFn = (async (_url: unknown, init?: RequestInit) => {
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async text() {
          return "";
        },
        async json() {
          return { choices: [{ message: { content: "x" } }] };
        },
      } as unknown as Response;
    }) as typeof fetch;

    const client = createLlmClient({ fetch: fetchFn });
    await client.complete(
      baseRequest({ model: "codestral-latest" }),
      new AbortController().signal,
    );
    const body = JSON.parse(String(capturedInit?.body));
    assert.ok(!("thinking" in body));
  });
});
