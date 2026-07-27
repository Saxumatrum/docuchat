import type { DocumentSummary } from "@/lib/types";

/**
 * A single embedded chunk of a source document.
 */
export interface StoredChunk {
  id: string;
  text: string;
  sourceName: string;
  chunkIndex: number;
  embedding: number[];
}

/**
 * Simple in-memory vector store.
 *
 * This is intentionally dependency-free: chunks live in a module-level
 * array and similarity search is plain cosine similarity over that array.
 * It is a fine fit for a single-process demo, but it is NOT suitable for
 * production or multi-instance deployments:
 *
 *  - The array resets whenever the server process restarts.
 *  - There is no per-user/session isolation — every visitor to this demo
 *    shares the same document store.
 *  - Search is O(n) over every stored chunk, with no persistence, sharding,
 *    or approximate-nearest-neighbor indexing.
 *
 * For real usage, swap this module for a hosted vector database (e.g.
 * Postgres + pgvector, Pinecone, Turbopuffer) while keeping the same
 * `addChunks` / `searchSimilarChunks` interface.
 */
const chunks: StoredChunk[] = [];

export function addChunks(newChunks: StoredChunk[]): void {
  chunks.push(...newChunks);
}

export function clearStore(): void {
  chunks.length = 0;
}

export function getDocumentSummaries(): DocumentSummary[] {
  const counts = new Map<string, number>();
  for (const chunk of chunks) {
    counts.set(chunk.sourceName, (counts.get(chunk.sourceName) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([sourceName, chunkCount]) => ({
    sourceName,
    chunkCount,
  }));
}

export function hasDocuments(): boolean {
  return chunks.length > 0;
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
  queryEmbedding: number[],
  topK: number = 5,
): SimilarChunk[] {
  return chunks
    .map((chunk) => ({ ...chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
