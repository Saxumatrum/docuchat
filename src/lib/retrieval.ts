import type { DocumentSummary, StoredChunk } from "@/lib/types";

/**
 * Dependency-free vector search over an in-memory array of chunks.
 *
 * The array lives in the visitor's browser, not on the server: upload
 * returns each chunk with its embedding, and the browser runs this search
 * itself before every question. That keeps the public demo private (one
 * visitor's documents are never visible to another) and stateless (any
 * server instance can answer any request).
 *
 * Search is plain O(n) cosine similarity, which is fine for a handful of
 * documents. For real usage, swap this for a hosted vector database (e.g.
 * Postgres + pgvector, Pinecone, Turbopuffer).
 */

export function summarizeDocuments(chunks: StoredChunk[]): DocumentSummary[] {
  const counts = new Map<string, number>();
  for (const chunk of chunks) {
    counts.set(chunk.sourceName, (counts.get(chunk.sourceName) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([sourceName, chunkCount]) => ({
    sourceName,
    chunkCount,
  }));
}

/**
 * Cosine similarity between two equal-length vectors, computed from
 * scratch (no external math library).
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface SimilarChunk extends StoredChunk {
  score: number;
}

/**
 * Returns the top-K chunks most similar to the query embedding, ranked by
 * cosine similarity (highest first).
 */
export function searchSimilarChunks(
  chunks: StoredChunk[],
  queryEmbedding: number[],
  topK: number = 5,
): SimilarChunk[] {
  return chunks
    .map((chunk) => ({ ...chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
