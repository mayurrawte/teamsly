import OpenAI from "openai";

/** gpt-5.4-nano: latest nano, $0.20/$1.25 per 1M, 400K ctx, supports Structured Outputs. */
export const AI_MODEL = "gpt-5.4-nano";

let cached: OpenAI | null | undefined;

export function getOpenAI(): OpenAI | null {
  if (cached !== undefined) return cached;
  const key = process.env.OPENAI_API_KEY;
  // OPENAI_BASE_URL lets this point at any OpenAI-compatible endpoint — e.g.
  // an Azure AI Foundry deployment's `/openai/v1/` surface (model = deployment
  // name). Unset → the SDK default (api.openai.com).
  cached = key
    ? new OpenAI({ apiKey: key, baseURL: process.env.OPENAI_BASE_URL })
    : null;
  return cached;
}

/**
 * One place for the GPT-5 reasoning-model quirks:
 * - `max_completion_tokens` (NOT `max_tokens`, which 400s on reasoning models)
 * - `reasoning_effort: "minimal"` — these are summarization/extraction tasks, not
 *   reasoning; "minimal" keeps reasoning tokens (and cost) near zero. Do NOT use
 *   "none": with max_completion_tokens it's a documented footgun (ignores the flag,
 *   burns the budget on invisible reasoning, returns "").
 * - no `temperature` (reasoning models reject non-default values).
 */
export async function chatComplete(
  client: OpenAI,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  opts: {
    maxTokens: number;
    responseFormat?: OpenAI.Chat.Completions.ChatCompletionCreateParams["response_format"];
  }
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  return client.chat.completions.create({
    model: AI_MODEL,
    messages,
    reasoning_effort: "minimal",
    max_completion_tokens: opts.maxTokens,
    ...(opts.responseFormat ? { response_format: opts.responseFormat } : {}),
  });
}
