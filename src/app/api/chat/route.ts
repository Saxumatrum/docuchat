import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  embed,
  streamText,
  toUIMessageStream,
} from "ai";
import { hasDocuments, searchSimilarChunks } from "@/lib/store";
import { CHAT_MODEL, EMBEDDING_MODEL, RETRIEVAL_TOP_K } from "@/lib/models";
import type { ChatUIMessage, SourceCitation } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const SNIPPET_LENGTH = 280;

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

function extractLastUserText(messages: ChatUIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;

    return message.parts
      .filter((part): part is Extract<ChatUIMessage["parts"][number], { type: "text" }> =>
        part.type === "text",
      )
      .map((part) => part.text)
      .join("\n")
      .trim();
  }
  return "";
}

export async function POST(req: Request) {
  const { messages }: { messages: ChatUIMessage[] } = await req.json();
  const question = extractLastUserText(messages);

  const stream = createUIMessageStream<ChatUIMessage>({
    execute: async ({ writer }) => {
      let contextBlock =
        "No documents have been uploaded yet. Tell the user to upload a document before asking questions.";

      if (question && hasDocuments()) {
        const { embedding } = await embed({ model: EMBEDDING_MODEL, value: question });
        const matches = searchSimilarChunks(embedding, RETRIEVAL_TOP_K);

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
