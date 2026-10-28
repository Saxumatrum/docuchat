"use client";

import { useRef, useState } from "react";
import { withBase } from "@/lib/basePath";
import { SAMPLE_FILE } from "@/lib/samples";
import type { DocumentSummary, StoredChunk } from "@/lib/types";

interface UploadResult {
  sourceName: string;
  chunkCount: number;
  error?: string;
}

export function FileUpload({
  documents,
  onChunksAdded,
}: {
  documents: DocumentSummary[];
  onChunksAdded: (chunks: StoredChunk[]) => void;
}) {
  const [results, setResults] = useState<UploadResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  async function handleSample() {
    try {
      const res = await fetch(withBase(`/samples/${SAMPLE_FILE}`));
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      await uploadFiles([new File([blob], SAMPLE_FILE, { type: "application/pdf" })]);
    } catch {
      setError("Couldn't load the sample. Try uploading your own file.");
    }
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    await uploadFiles(Array.from(fileList));
  }

  async function uploadFiles(files: File[]) {
    setIsUploading(true);
    setError(null);
    setResults([]);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const res = await fetch(withBase("/api/upload"), { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }

      setResults(data.results);
      if (data.chunks.length > 0) onChunksAdded(data.chunks);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    if (isUploading) return;
    dragCounter.current += 1;
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (isUploading) return;
    handleFiles(e.dataTransfer.files);
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
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          isUploading
            ? "cursor-not-allowed border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
            : isDragging
              ? "border-zinc-500 bg-zinc-100 dark:border-zinc-400 dark:bg-zinc-900"
              : "border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
        }`}
      >
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {isUploading ? "Processing…" : isDragging ? "Drop to upload" : "Click or drag files to upload"}
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-600">
          PDF, TXT, MD, or DOCX — up to 4MB in total
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

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        No file handy?{" "}
        <button
          type="button"
          onClick={handleSample}
          disabled={isUploading}
          className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600 disabled:opacity-50 dark:text-zinc-100 dark:hover:text-zinc-300"
        >
          Try a sample staff handbook
        </button>
      </p>

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
