import { embed } from "ai";
import { NextResponse } from "next/server";
import { EMBEDDING_MODEL } from "@/lib/models";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_QUESTION_CHARS = 2000;

/**
 * Embeds a question so the browser can rank its own chunks against it.
 * Uses the same model as upload, so the vectors are comparable.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, "embed", 60);
  if (limited) return limited;

  const { text } = (await req.json().catch(() => ({}))) as { text?: unknown };
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Expected a non-empty \"text\" field." }, { status: 400 });
  }
  if (text.length > MAX_QUESTION_CHARS) {
    return NextResponse.json({ error: "Question is too long." }, { status: 400 });
  }

  const { embedding } = await embed({ model: EMBEDDING_MODEL, value: text });
  return NextResponse.json({ embedding });
}
