# docuchat

A small retrieval-augmented generation (RAG) chatbot. Upload one or more
documents (PDF, TXT, or Markdown), then ask questions — the assistant answers
strictly from the content you uploaded and cites which chunk of which
document each part of its answer came from.

Built as a self-contained demo: no external database, no vector DB service,
no accounts. Everything runs in a single Next.js app.

## Tech stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS)
- **Vercel AI SDK** (`ai` + `@ai-sdk/react`) for streaming chat (`useChat`) and
  embeddings (`embed` / `embedMany`)
- **Vercel AI Gateway** model resolution — models are referenced as plain
  `"provider/model"` strings (e.g. `"anthropic/claude-sonnet-5"`,
  `"openai/text-embedding-3-small"`); no provider-specific SDK package is
  installed
- **pdf-parse** for PDF text extraction; plain text/Markdown files are read
  directly
- A hand-rolled, in-memory vector store (array of chunks + cosine similarity)
  — no external vector database

## Setup

```bash
npm install
cp .env.example .env.local
# then edit .env.local and set AI_GATEWAY_API_KEY (or ANTHROPIC_API_KEY / OPENAI_API_KEY)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Upload a document from
the left panel, then ask a question in the chat panel on the right.

Without an API key set, the app still boots, the upload flow still extracts
and chunks text, and embedding/chat calls will fail with a clear error from
the AI SDK once a request actually reaches the model provider.

## How it works

1. **Upload** — `POST /api/upload` accepts one or more files. PDFs are parsed
   with `pdf-parse`; `.txt`/`.md` files are read as plain text.
2. **Chunking** — each document's text is split into overlapping ~550-word
   chunks (roughly 500-800 tokens, with a ~60-word overlap so context isn't
   lost at chunk boundaries). See `src/lib/chunk.ts`.
3. **Embedding** — every chunk is embedded in a single batched call via the AI
   SDK's `embedMany`, using `openai/text-embedding-3-small` through the AI
   Gateway. Chunks are stored in memory alongside their source filename and
   chunk index (`src/lib/store.ts`).
4. **Retrieval** — when a question comes in, `POST /api/chat` embeds the
   question with `embed`, then ranks every stored chunk by cosine similarity
   and takes the top 5 matches.
5. **Generation** — the top matches are formatted into a numbered context
   block and passed to `streamText` (model: `anthropic/claude-sonnet-5`) as
   part of the system prompt, with instructions to cite sources inline using
   bracketed numbers like `[1]`.
6. **Citations** — the retrieved chunks are also streamed to the client as a
   custom `data-sources` UI message part, which the chat UI renders as a
   "Sources" list (filename, chunk number, match score, and a snippet) below
   each assistant message.

## Project layout

```
src/
  app/
    api/
      upload/route.ts   # extract -> chunk -> embed -> store
      chat/route.ts     # embed question -> retrieve -> stream answer + sources
    page.tsx             # landing page: upload panel + chat panel
  components/
    FileUpload.tsx       # upload UI, document list, per-file status
    ChatPanel.tsx         # useChat-powered chat UI with citations
  lib/
    chunk.ts              # word-based chunking with overlap
    store.ts               # in-memory vector store (cosine similarity)
    models.ts              # model IDs + retrieval settings
    types.ts                # shared UI message / citation types
```

## Important limitations (by design, for a demo)

- The vector store is a **module-level in-memory array**. It resets whenever
  the server restarts, and it is shared across every visitor — there is no
  per-user or per-session isolation. This is intentional for a small,
  self-contained demo and is **not** suitable for production or multi-user
  deployments. Swap `src/lib/store.ts` for a real vector database (Postgres +
  pgvector, Pinecone, Turbopuffer, etc.) to make this production-ready.
- There is no authentication, rate limiting, or file-size validation beyond
  what the browser/runtime enforce by default.

## Scripts

```bash
npm run dev     # start the dev server
npm run build   # production build (typechecks + lints as part of the build)
npm run lint    # run ESLint
npm run start   # run the production build
```
