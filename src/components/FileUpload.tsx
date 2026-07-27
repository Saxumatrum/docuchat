"use client";

import { useEffect, useRef, useState } from "react";
import type { DocumentSummary } from "@/lib/types";

interface UploadResult {
  sourceName: string;
  chunkCount: number;
  error?: string;
}

export function FileUpload({
  onDocumentsChange,
}: {
  onDocumentsChange: (documents: DocumentSummary[]) => void;
}) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/upload")
      .then((res) => res.json())
      .then((data: { documents: DocumentSummary[] }) => {
        if (cancelled) return;
        setDocuments(data.documents);
        onDocumentsChange(data.documents);
      })
      .catch(() => {
        // Non-fatal: the upload panel simply starts empty.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    setError(null);
    setResults([]);

    try {
      const formData = new FormData();
      Array.from(fileList).forEach((file) => formData.append("files", file));

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }

      setResults(data.results);
      setDocuments(data.documents);
      onDocumentsChange(data.documents);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Documents</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Upload .pdf, .txt, .md, or .docx files to chat with them.
        </p>
      </div>

      <label
        htmlFor="file-upload"
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          isUploading
            ? "cursor-not-allowed border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
            : "border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
        }`}
      >
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {isUploading ? "Processing…" : "Click to upload"}
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-600">
          PDF, TXT, MD, or DOCX — multiple files supported
        </span>
        <input
          ref={inputRef}
          id="file-upload"
          type="file"
          multiple
          accept=".pdf,.txt,.md,.docx,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={isUploading}
          onChange={(e) => handleFiles(e.target.files)}
          className="sr-only"
        />
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-1 text-xs">
          {results.map((result) => (
            <li
              key={result.sourceName}
              className={result.error ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}
            >
              {result.error
                ? `${result.sourceName}: ${result.error}`
                : `${result.sourceName}: ${result.chunkCount} chunks indexed`}
            </li>
          ))}
        </ul>
      )}

      <div className="flex-1 overflow-y-auto">
        {documents.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-600">No documents uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.sourceName}
                className="flex items-center justify-between rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <span className="truncate font-medium">{doc.sourceName}</span>
                <span className="ml-2 shrink-0 text-zinc-400 dark:text-zinc-500">
                  {doc.chunkCount} chunks
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
