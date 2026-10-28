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

/**
 * A single embedded chunk of a source document. Returned by the upload
 * route and kept in the visitor's browser; the server stores nothing.
 */
export type StoredChunk = {
  id: string;
  text: string;
  sourceName: string;
  chunkIndex: number;
  embedding: number[];
};

/**
 * A chunk the browser retrieved for a question, sent with the chat request
 * as context (embedding dropped, since the server only needs the text).
 */
export type RetrievedChunk = Omit<StoredChunk, "embedding"> & { score: number };

/** Summary of an uploaded document, derived from its chunks. */
export type DocumentSummary = {
  sourceName: string;
  chunkCount: number;
};
