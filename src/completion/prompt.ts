import type { CursorContext } from "./context";
import type { AutocompleteConfig } from "../config/configuration";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Example of the JSON object we ask the model to emit. Kept tiny on purpose:
 * a single `text` field holding the exact text to insert at the cursor.
 */
export const COMPLETION_RESPONSE_EXAMPLE =
  '{ "text": "<the exact code to insert at the cursor including leading newlines>" }';

const SYSTEM_PROMPT = [
  "You are an expert code completion engine.",
  "The user's editor contains the file shown below. The text <<<CURSOR>>> marks the cursor position.",
  "Respond ONLY with a single JSON object and nothing else. The JSON object MUST have this shape:",
  COMPLETION_RESPONSE_EXAMPLE,
  'The "text" value must be the exact text to insert at <<<CURSOR>>>.',
  "Do NOT repeat code or syntax that already appears on the lines before or after <<<CURSOR>>>.",
  "Do NOT wrap the JSON in a markdown code fence and do NOT add any prose or explanation.",
  'If no completion is appropriate, respond with { "text": "" }.',
  "The response must be valid JSON that can be parsed by JSON.parse.",
].join(" ");

export function buildMessages(ctx: CursorContext, _cfg: AutocompleteConfig): ChatMessage[] {
  const fileName = ctx.filePath ? ctx.filePath : "<untitled>";
  const user = [
    `Path: ${fileName}`,
    `Language: ${ctx.languageId}`,
    "",
    "```",
    `${ctx.prefix}<<<CURSOR>>>${ctx.suffix}`,
    "```",
    "",
    `Return ONLY a JSON object ${COMPLETION_RESPONSE_EXAMPLE} whose "text" is the exact code to insert at <<<CURSOR>>>.`,
    "Do not repeat the text already present before or after <<<CURSOR>>>.",
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
  responseFormat?: { type: "json_object" };
}

export function buildRequest(messages: ChatMessage[], cfg: AutocompleteConfig, apiKey: string): CompletionRequest {
  return {
    baseUrl: cfg.apiBaseUrl,
    apiKey,
    model: cfg.model,
    messages,
    maxTokens: cfg.maxTokens,
    temperature: cfg.temperature,
    requestTimeoutMs: cfg.requestTimeoutMs,
    ...(cfg.jsonResponse ? { responseFormat: { type: "json_object" } } : {}),
  };
}
