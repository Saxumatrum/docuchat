import type { UIMessage } from "ai";

/**
 * A single retrieved chunk that was used to ground an assistant answer.
 * Sent to the client as a persistent "data-sources" part so the chat UI
 * can render a "Sources" list beneath the message.
 */
export type SourceCitation = {
  id: string;
  sourceName: string;
  chunkIndex: number;
  snippet: string;
  score: number;
};

/** Data parts our chat stream can emit, keyed by their `data-<key>` type. */
export type ChatDataParts = {
  sources: SourceCitation[];
};

/** The UI message shape used by both the client (`useChat`) and the server. */
export type ChatUIMessage = UIMessage<never, ChatDataParts>;

/** Summary of a document stored in the in-memory vector store. */
export type DocumentSummary = {
  sourceName: string;
  chunkCount: number;
};
