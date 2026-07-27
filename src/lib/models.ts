/**
 * Model identifiers, expressed as plain "provider/model" strings.
 *
 * These strings are resolved by the AI SDK's built-in Vercel AI Gateway
 * integration - no provider-specific SDK package (e.g. `@ai-sdk/anthropic`)
 * is required. At request time, the AI SDK looks for `AI_GATEWAY_API_KEY`
 * (routes through the Vercel AI Gateway) or a provider-specific key such as
 * `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` (calls that provider directly).
 * See the README for setup instructions.
 */
export const CHAT_MODEL = "anthropic/claude-sonnet-5";
export const EMBEDDING_MODEL = "openai/text-embedding-3-small";

/** Number of top-matching chunks retrieved for each question. */
export const RETRIEVAL_TOP_K = 5;
