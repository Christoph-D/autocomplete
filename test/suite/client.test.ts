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
    delayMs: 0,
    responseFormat: { type: "json_object" },
    ...overrides,
  };
}

function mockFetch(opts: { status?: number; body?: unknown; text?: string }): typeof fetch {
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
    assert.deepStrictEqual(body.response_format, { type: "json_object" });
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
    await client.complete(baseRequest({ baseUrl: "https://example.com/v1///" }), new AbortController().signal);
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

  test("forwards thinking override when set on the request", async () => {
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
    await client.complete(baseRequest({ thinking: { type: "disabled" } }), new AbortController().signal);
    const body = JSON.parse(String(capturedInit?.body));
    assert.deepStrictEqual(body.thinking, { type: "disabled" });
  });

  test("waits for delayMs before sending the request", async () => {
    let calledAt = 0;
    const start = Date.now();
    const fetchFn = (async () => {
      calledAt = Date.now();
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
    await client.complete(baseRequest({ delayMs: 40 }), new AbortController().signal);
    assert.ok(calledAt - start >= 30, `fetch happened after only ${calledAt - start}ms`);
  });

  test("abort during delay cancels the request and never calls fetch", async () => {
    let fetchCalled = false;
    const fetchFn = (async () => {
      fetchCalled = true;
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
    const controller = new AbortController();
    const p = client.complete(baseRequest({ delayMs: 500 }), controller.signal);
    await new Promise((r) => setTimeout(r, 10));
    controller.abort();
    await assert.rejects(
      () => p,
      (err: unknown) => err instanceof LlmError,
    );
    assert.strictEqual(fetchCalled, false);
  });

  test("cancels previous inflight request when a new one starts", async () => {
    // fetch that resolves with different content per call, delayed until
    // either the timer elapses or the supplied signal aborts.
    let callCount = 0;
    const fetchFn = (async (_url: unknown, init?: RequestInit) => {
      callCount += 1;
      const myCall = callCount;
      const signal = init?.signal as AbortSignal | undefined;
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, 50);
        const onAbort = () => {
          clearTimeout(t);
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        };
        if (signal) {
          if (signal.aborted) {
            onAbort();
          } else {
            signal.addEventListener("abort", onAbort, { once: true });
          }
        }
      });
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async text() {
          return "";
        },
        async json() {
          return { choices: [{ message: { content: `resp-${myCall}` } }] };
        },
      } as unknown as Response;
    }) as typeof fetch;

    const client = createLlmClient({ fetch: fetchFn });

    const first = client.complete(baseRequest(), new AbortController().signal);
    // Give the first request a tick to register as inflight.
    await Promise.resolve();
    const second = client.complete(baseRequest(), new AbortController().signal);

    await assert.rejects(
      () => first,
      (err: unknown) => err instanceof LlmError,
    );
    const out = await second;
    assert.strictEqual(out, "resp-2");
  });

  test("does not set thinking when the request does not specify one", async () => {
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
    await client.complete(baseRequest({ model: "glm-5.2" }), new AbortController().signal);
    const body = JSON.parse(String(capturedInit?.body));
    assert.ok(!("thinking" in body));
  });

  test("omits response_format when request does not specify one", async () => {
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
    const { responseFormat: _omit, ...reqWithoutFormat } = baseRequest();
    void _omit;
    await client.complete(reqWithoutFormat, new AbortController().signal);
    const body = JSON.parse(String(capturedInit?.body));
    assert.ok(!("response_format" in body));
  });
});
