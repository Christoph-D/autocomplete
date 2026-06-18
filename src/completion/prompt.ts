import type { CursorContext } from "./context";
import type { AutocompleteConfig } from "../config/configuration";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = [
  "You are an expert code completion engine.",
  "The user's editor contains the file shown below. The text <<<CURSOR>>> marks the cursor position.",
  "Reply ONLY with the exact text that should be inserted at <<<CURSOR>>>'s line wrapped in a single markdown code fence.",
  "Do not include prose or any explanation outside the code fence.",
  "Do not repeat code or syntax that already appears in the lines before or after <<<CURSOR>>>.",
  "If no completion is appropriate, reply with an empty string.",
].join(" ");

export function buildMessages(
  ctx: CursorContext,
  _cfg: AutocompleteConfig,
): ChatMessage[] {
  const fileName = ctx.filePath ? ctx.filePath : "<untitled>";
  const user = [
    `Path: ${fileName}`,
    `Language: ${ctx.languageId}`,
    "",
    "```",
    `${ctx.prefix}<<<CURSOR>>>${ctx.suffix}`,
    "```",
    "",
    `Begin your response with:`,
    "```",
    ctx.lineBeforeCursor,
  ].join("\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}

export interface CompletionRequest {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  requestTimeoutMs: number;
}

export function buildRequest(
  messages: ChatMessage[],
  cfg: AutocompleteConfig,
  apiKey: string,
): CompletionRequest {
  return {
    baseUrl: cfg.apiBaseUrl,
    apiKey,
    model: cfg.model,
    messages,
    maxTokens: cfg.maxTokens,
    temperature: cfg.temperature,
    requestTimeoutMs: cfg.requestTimeoutMs,
  };
}
