"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { withBase } from "@/lib/basePath";
import { RETRIEVAL_TOP_K } from "@/lib/models";
import { searchSimilarChunks } from "@/lib/retrieval";
import { SAMPLE_FILE, SAMPLE_QUESTIONS } from "@/lib/samples";
import type { ChatUIMessage, RetrievedChunk, SourceCitation, StoredChunk } from "@/lib/types";

function SourcesList({ sources }: { sources: SourceCitation[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Sources
      </p>
      <ol className="space-y-2">
        {sources.map((source, index) => (
          <li key={source.id} className="text-xs text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              [{index + 1}] {source.sourceName}
            </span>{" "}
            <span className="text-zinc-500 dark:text-zinc-500">
              (chunk {source.chunkIndex + 1} · match {(source.score * 100).toFixed(0)}%)
            </span>
            <p className="mt-0.5 line-clamp-2 text-zinc-500 dark:text-zinc-500">
              {source.snippet}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatUIMessage }) {
  const isUser = message.role === "user";
  const textParts = message.parts.filter(
    (part): part is Extract<ChatUIMessage["parts"][number], { type: "text" }> =>
      part.type === "text",
  );
  const sourcesPart = message.parts.find(
    (part): part is Extract<ChatUIMessage["parts"][number], { type: "data-sources" }> =>
      part.type === "data-sources",
  );

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
            : "bg-white text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800"
        }`}
      >
        {textParts.length > 0 ? (
          textParts.map((part, index) => (
            <p key={index} className="whitespace-pre-wrap">
              {part.text}
            </p>
          ))
        ) : (
          <p className="italic text-zinc-400">Thinking…</p>
        )}
        {!isUser && sourcesPart && <SourcesList sources={sourcesPart.data} />}
      </div>
    </div>
  );
}

/**
 * Embeds the question on the server, then ranks this visitor's own chunks
 * against it here in the browser.
 */
async function retrieve(question: string, chunks: StoredChunk[]): Promise<RetrievedChunk[]> {
  const res = await fetch(withBase("/api/embed"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: question }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Couldn't search your documents.");

  // Send only the text with the chat request; the embeddings stay here.
  return searchSimilarChunks(chunks, data.embedding, RETRIEVAL_TOP_K).map((match) => ({
    id: match.id,
    text: match.text,
    sourceName: match.sourceName,
    chunkIndex: match.chunkIndex,
    score: match.score,
  }));
}

export function ChatPanel({ chunks }: { chunks: StoredChunk[] }) {
  const { messages, sendMessage, status, error, clearError } = useChat<ChatUIMessage>({
    transport: new DefaultChatTransport({ api: withBase("/api/chat") }),
  });
  const [input, setInput] = useState("");
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [retrieveError, setRetrieveError] = useState<string | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const documentsReady = chunks.length > 0;
  const sampleLoaded = chunks.some((chunk) => chunk.sourceName === SAMPLE_FILE);
  const isBusy = isRetrieving || status === "submitted" || status === "streaming";

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isBusy) return;
    setRetrieveError(null);
    setIsRetrieving(true);
    try {
      const context = await retrieve(trimmed, chunks);
      sendMessage({ text: trimmed }, { body: { context } });
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch (err) {
      setRetrieveError(err instanceof Error ? err.message : "Couldn't search your documents.");
    } finally {
      setIsRetrieving(false);
    }
  }

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    ask(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      handleSubmit(e);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {documentsReady
                ? "Ask a question about your document."
                : "Upload a document to start chatting."}
            </p>
            <p className="max-w-xs text-xs text-zinc-400 dark:text-zinc-600">
              Answers are grounded in the text you uploaded, with citations back to the
              source chunks.
            </p>
            {sampleLoaded && (
              <div className="mt-3 flex max-w-md flex-wrap justify-center gap-2">
                {SAMPLE_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => ask(question)}
                    disabled={isBusy}
                    className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {retrieveError && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900">
            {retrieveError}
          </p>
        )}

        {(isRetrieving || status === "submitted") && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white px-4 py-3 text-sm text-zinc-400 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900">
              <p className="font-medium">Something went wrong.</p>
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error.message}</p>
              <button
                type="button"
                onClick={() => clearError()}
                className="mt-2 text-xs font-medium underline underline-offset-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <div ref={scrollAnchorRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-zinc-200 px-4 py-3 sm:px-6 dark:border-zinc-800"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={!documentsReady || isBusy}
          placeholder={
            documentsReady
              ? "Ask a question about your document… (Shift+Enter for a new line)"
              : "Upload a document first…"
          }
          className="max-h-40 flex-1 resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={!documentsReady || isBusy || !input.trim()}
          className="shrink-0 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isBusy ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
