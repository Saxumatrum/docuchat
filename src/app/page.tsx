"use client";

import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { ChatPanel } from "@/components/ChatPanel";
import { summarizeDocuments } from "@/lib/retrieval";
import type { StoredChunk } from "@/lib/types";

export default function Home() {
  // The whole "vector store" for this visitor: chunks plus embeddings,
  // held in the browser for as long as the tab is open.
  const [chunks, setChunks] = useState<StoredChunk[]>([]);
  const documents = summarizeDocuments(chunks);

  function handleChunksAdded(added: StoredChunk[]) {
    // Re-uploading a file replaces its old chunks rather than duplicating them.
    const names = new Set(added.map((chunk) => chunk.sourceName));
    setChunks((prev) => [...prev.filter((chunk) => !names.has(chunk.sourceName)), ...added]);
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-1">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">docuchat</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Upload a document and chat with an assistant that answers only from what you
            uploaded, with citations back to the source text.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row">
        <aside className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 lg:w-80 lg:shrink-0">
          <FileUpload documents={documents} onChunksAdded={handleChunksAdded} />
        </aside>

        <section className="flex min-h-[32rem] flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
          <ChatPanel chunks={chunks} />
        </section>
      </main>

      <footer className="border-t border-zinc-200 px-6 py-3 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
        Your documents stay in this browser tab. The server reads them to build embeddings,
        then keeps nothing.
      </footer>
    </div>
  );
}
