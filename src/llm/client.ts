import type { CompletionRequest } from "../completion/prompt";

export class LlmError extends Error {
  public readonly status?: number;
  public override readonly cause?: unknown;
  public readonly abortedBeforeFetch?: boolean;

  constructor(message: string, status?: number, cause?: unknown, abortedBeforeFetch?: boolean) {
    super(message);
    this.name = "LlmError";
    if (status !== undefined) {
      this.status = status;
    }
    if (cause !== undefined) {
      this.cause = cause;
    }
    if (abortedBeforeFetch !== undefined) {
      this.abortedBeforeFetch = abortedBeforeFetch;
    }
  }
}

export interface LlmClient {
  complete(req: CompletionRequest, signal: AbortSignal): Promise<string>;
}

export interface LlmClientDeps {
  fetch?: typeof fetch;
}

export function createLlmClient(deps: LlmClientDeps = {}): LlmClient {
  const doFetch = deps.fetch ?? fetch;
  let inflight: AbortController | null = null;

  return {
    async complete(req, signal): Promise<string> {
      // Single-flight: cancel any previously in-flight request before starting.
      if (inflight) {
        inflight.abort();
      }
      if (signal.aborted) {
        throw new LlmError("LLM request aborted (timeout or user cancellation).");
      }

      const url = `${req.baseUrl.replace(/\/+$/, "")}/chat/completions`;

      const controller = new AbortController();
      inflight = controller;
      const timer = setTimeout(() => controller.abort(), Math.max(100, req.requestTimeoutMs));

      const onParentAbort = () => controller.abort();
      signal.addEventListener("abort", onParentAbort, { once: true });

      let fetchStarted = false;
      try {
        await waitFor(req.delayMs, controller.signal);
        fetchStarted = true;

        const reqBody: Record<string, unknown> = {
          model: req.model,
          messages: req.messages,
          max_tokens: req.maxTokens,
          temperature: req.temperature,
          stream: false,
        };
        if (req.responseFormat) {
          reqBody.response_format = req.responseFormat;
        }
        if (req.thinking) {
          reqBody.thinking = req.thinking;
        }

        const res = await doFetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${req.apiKey}`,
          },
          body: JSON.stringify(reqBody),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new LlmError(
            `LLM request failed: ${res.status} ${res.statusText}${body ? ` — ${truncate(body, 300)}` : ""}`,
            res.status,
          );
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string | null } }>;
        };
        const content = data?.choices?.[0]?.message?.content;
        return typeof content === "string" ? content : "";
      } catch (err) {
        if (err instanceof LlmError) {
          throw err;
        }
        if ((err as { name?: string }).name === "AbortError") {
          throw new LlmError(
            "LLM request aborted (timeout or user cancellation).",
            undefined,
            undefined,
            !fetchStarted,
          );
        }
        throw new LlmError(`LLM request error: ${err instanceof Error ? err.message : String(err)}`, undefined, err);
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", onParentAbort);
        if (inflight === controller) {
          inflight = null;
        }
      }
    },
  };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

function waitFor(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      const err = new Error("aborted");
      err.name = "AbortError";
      reject(err);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
