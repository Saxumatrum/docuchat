"use client";

import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { ChatPanel } from "@/components/ChatPanel";
import type { DocumentSummary } from "@/lib/types";

export default function Home() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const documentsReady = documents.length > 0;

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
          <FileUpload onDocumentsChange={setDocuments} />
        </aside>

        <section className="flex min-h-[32rem] flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
          <ChatPanel documentsReady={documentsReady} />
        </section>
      </main>

      <footer className="border-t border-zinc-200 px-6 py-3 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
        Documents are stored in memory for this server session only — they reset on restart.
      </footer>
    </div>
  );
}
