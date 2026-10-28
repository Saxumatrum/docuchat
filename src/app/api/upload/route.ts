import { NextResponse } from "next/server";
import { embedMany } from "ai";
import { chunkText } from "@/lib/chunk";
import { EMBEDDING_MODEL } from "@/lib/models";
import { rateLimit } from "@/lib/rateLimit";
import type { StoredChunk } from "@/lib/types";

// pdf-parse relies on Node APIs (Buffer), so this route must run on Node,
// not the Edge runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx"];

// Vercel caps request and response bodies at 4.5MB. Uploads are capped
// below that, and chunks per request are capped so the embeddings sent
// back (about 12KB each once rounded) stay well under it too.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_CHUNKS_PER_REQUEST = 120;

/** Four decimal places is plenty for cosine ranking and shrinks the JSON. */
function roundEmbedding(embedding: number[]): number[] {
  return embedding.map((value) => Math.round(value * 1e4) / 1e4);
}

interface UploadResult {
  sourceName: string;
  chunkCount: number;
  error?: string;
}

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    // The worker entry must load first: it polyfills DOMMatrix and friends,
    // which pdf.js needs but serverless Node (e.g. Vercel) doesn't have.
    const { CanvasFactory, getData } = await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");
    PDFParse.setWorker(getData());
    const parser = new PDFParse({ data: buffer, CanvasFactory });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (name.endsWith(".docx")) {
    const { extractRawText } = await import("mammoth");
    const result = await extractRawText({ buffer });
    return result.value;
  }

  return buffer.toString("utf-8");
}

export async function POST(req: Request) {
  const limited = rateLimit(req, "upload", 15);
  if (limited) return limited;

  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Upload is too large. Maximum is 4MB in total." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with one or more \"files\" entries." },
      { status: 400 },
    );
  }

  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files were provided." }, { status: 400 });
  }

  const results: UploadResult[] = [];
  const chunksOut: StoredChunk[] = [];

  for (const file of files) {
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      results.push({
        sourceName: file.name,
        chunkCount: 0,
        error: `Unsupported file type "${extension || "unknown"}". Use .pdf, .txt, .md, or .docx.`,
      });
      continue;
    }

    try {
      const text = await extractText(file);
      const chunks = chunkText(text);

      if (chunks.length === 0) {
        results.push({
          sourceName: file.name,
          chunkCount: 0,
          error: "No extractable text was found in this file.",
        });
        continue;
      }

      if (chunksOut.length + chunks.length > MAX_CHUNKS_PER_REQUEST) {
        results.push({
          sourceName: file.name,
          chunkCount: 0,
          error: "Too much text for this demo. Try a shorter document or upload fewer at once.",
        });
        continue;
      }

      const { embeddings } = await embedMany({
        model: EMBEDDING_MODEL,
        values: chunks,
      });

      chunksOut.push(
        ...chunks.map((chunkContent, index) => ({
          id: `${file.name}::${index}::${Date.now()}`,
          text: chunkContent,
          sourceName: file.name,
          chunkIndex: index,
          embedding: roundEmbedding(embeddings[index]),
        })),
      );
      results.push({ sourceName: file.name, chunkCount: chunks.length });
    } catch (error) {
      results.push({
        sourceName: file.name,
        chunkCount: 0,
        error: error instanceof Error ? error.message : "Failed to process this file.",
      });
    }
  }

  // Nothing is kept server-side: the browser holds the chunks and runs
  // retrieval itself (see lib/retrieval.ts).
  return NextResponse.json({ results, chunks: chunksOut });
}
