import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from "ai";
import { CHAT_MODEL, RETRIEVAL_TOP_K } from "@/lib/models";
import { rateLimit } from "@/lib/rateLimit";
import type { ChatUIMessage, RetrievedChunk, SourceCitation } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const SNIPPET_LENGTH = 280;
// Chunks are ~550 words, so this leaves headroom while capping prompt size.
const MAX_CHUNK_CHARS = 8000;
// Only recent turns are sent to the model, to bound cost per request.
const MAX_HISTORY_MESSAGES = 10;

/**
 * The browser runs retrieval over its own chunks and sends the matches.
 * They're the visitor's own text, so this only checks shape and size.
 */
function parseContext(raw: unknown): RetrievedChunk[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, RETRIEVAL_TOP_K)
    .filter(
      (chunk): chunk is RetrievedChunk =>
        typeof chunk?.id === "string" &&
        typeof chunk.text === "string" &&
        typeof chunk.sourceName === "string" &&
        typeof chunk.chunkIndex === "number" &&
        typeof chunk.score === "number",
    )
    .map((chunk) => ({ ...chunk, text: chunk.text.slice(0, MAX_CHUNK_CHARS) }));
}

function buildSystemPrompt(contextBlock: string): string {
  return [
    "You are docuchat, an assistant that answers questions strictly using the",
    "numbered context excerpts provided below. Each excerpt is taken from a",
    'document the user uploaded, and is labeled with a citation number like "[1]".',
    "",
    "Rules:",
    "- Ground every claim in the provided context. Do not use outside knowledge.",
    "- Cite the excerpt(s) you used inline with their bracketed number, e.g. \"Revenue grew 12% [1].\"",
    "- If the context does not contain the answer, say so plainly instead of guessing.",
    "- Keep answers concise and directly responsive to the question.",
    "",
    "Context:",
    contextBlock,
  ].join("\n");
}

export async function POST(req: Request) {
  const limited = rateLimit(req, "chat", 40);
  if (limited) return limited;

  const body: { messages: ChatUIMessage[]; context?: unknown } = await req.json();
  const messages = body.messages.slice(-MAX_HISTORY_MESSAGES);
  const matches = parseContext(body.context);

  const stream = createUIMessageStream<ChatUIMessage>({
    execute: async ({ writer }) => {
      let contextBlock =
        "No documents have been uploaded yet. Tell the user to upload a document before asking questions.";

      if (matches.length > 0) {
        const sources: SourceCitation[] = matches.map((match) => ({
          id: match.id,
          sourceName: match.sourceName,
          chunkIndex: match.chunkIndex,
          snippet:
            match.text.length > SNIPPET_LENGTH
              ? `${match.text.slice(0, SNIPPET_LENGTH)}…`
              : match.text,
          score: match.score,
        }));

        // Persistent data part: rendered by the client as a "Sources" list
        // beneath the assistant's message.
        writer.write({
          type: "data-sources",
          id: "sources",
          data: sources,
        });

        contextBlock = matches
          .map(
            (match, index) =>
              `[${index + 1}] (source: "${match.sourceName}", chunk ${match.chunkIndex + 1})\n${match.text}`,
          )
          .join("\n\n---\n\n");
      }

      const result = streamText({
        model: CHAT_MODEL,
        system: buildSystemPrompt(contextBlock),
        messages: await convertToModelMessages(messages),
      });

      writer.merge(toUIMessageStream({ stream: result.stream }));
    },
  });

  return createUIMessageStreamResponse({ stream });
}
