/**
 * Splits a document into overlapping chunks sized for embedding + retrieval.
 *
 * Chunking is word-based rather than character-based: it approximates
 * ~500-800 tokens per chunk (roughly 1.3 tokens per English word) while
 * staying simple and dependency-free. A small overlap between consecutive
 * chunks keeps context from being cut off mid-thought at chunk boundaries.
 */
export interface ChunkOptions {
  /** Target number of words per chunk. */
  chunkSizeWords?: number;
  /** Number of words repeated at the start of the next chunk. */
  overlapWords?: number;
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  chunkSizeWords: 550, // ~730 tokens
  overlapWords: 60, // ~80 tokens of overlap
};

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const { chunkSizeWords, overlapWords } = { ...DEFAULT_OPTIONS, ...options };

  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return [];

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSizeWords, words.length);
    chunks.push(words.slice(start, end).join(" "));

    if (end === words.length) break;
    start = end - overlapWords;
  }

  return chunks;
}
