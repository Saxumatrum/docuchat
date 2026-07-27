import { NextResponse } from "next/server";
import { embedMany } from "ai";
import { chunkText } from "@/lib/chunk";
import { addChunks, getDocumentSummaries, type StoredChunk } from "@/lib/store";
import { EMBEDDING_MODEL } from "@/lib/models";

// pdf-parse relies on Node APIs (Buffer), so this route must run on Node,
// not the Edge runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx"];

interface UploadResult {
  sourceName: string;
  chunkCount: number;
  error?: string;
}

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
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

      const { embeddings } = await embedMany({
        model: EMBEDDING_MODEL,
        values: chunks,
      });

      const stored: StoredChunk[] = chunks.map((chunkContent, index) => ({
        id: `${file.name}::${index}::${Date.now()}`,
        text: chunkContent,
        sourceName: file.name,
        chunkIndex: index,
        embedding: embeddings[index],
      }));

      addChunks(stored);
      results.push({ sourceName: file.name, chunkCount: chunks.length });
    } catch (error) {
      results.push({
        sourceName: file.name,
        chunkCount: 0,
        error: error instanceof Error ? error.message : "Failed to process this file.",
      });
    }
  }

  return NextResponse.json({ results, documents: getDocumentSummaries() });
}

export async function GET() {
  return NextResponse.json({ documents: getDocumentSummaries() });
}
