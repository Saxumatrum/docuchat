# docuchat

A small retrieval-augmented generation (RAG) chatbot. Upload one or more
documents (PDF, TXT, Markdown, or DOCX), then ask questions — the assistant answers
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
- **pdf-parse** for PDF text extraction, **mammoth** for DOCX text extraction;
  plain text/Markdown files are read directly
- Hand-rolled retrieval (an array of chunks + cosine similarity) that runs in
  the visitor's browser — no external vector database

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
   with `pdf-parse`, `.docx` files with `mammoth`; `.txt`/`.md` files are read
   as plain text.
2. **Chunking** — each document's text is split into chunks of whole
   sentences, packed up to ~120 words, with one sentence of overlap so context
   isn't lost at boundaries. On the sample handbook this ranks the answering
   chunk first for 10/10 test questions (550-word windows managed 6/10). See
   `src/lib/chunk.ts`.
3. **Embedding** — every chunk is embedded in a single batched call via the AI
   SDK's `embedMany`, using `openai/text-embedding-3-small` through the AI
   Gateway. The chunks and their embeddings are returned to the browser; the
   server keeps nothing.
4. **Retrieval** — when a question is asked, the browser gets its embedding
   from `POST /api/embed`, ranks its own chunks by cosine similarity
   (`src/lib/retrieval.ts`) and takes the top 5 matches.
5. **Generation** — the top matches are sent to `POST /api/chat`, formatted into a numbered context
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
      upload/route.ts   # extract -> chunk -> embed -> return to browser
      embed/route.ts    # embed a question for client-side retrieval
      chat/route.ts     # retrieved context -> stream answer + sources
    page.tsx             # landing page: upload panel + chat panel
  components/
    FileUpload.tsx       # upload UI, document list, per-file status
    ChatPanel.tsx         # useChat-powered chat UI with citations
  lib/
    chunk.ts              # sentence-based chunking with overlap
    retrieval.ts           # cosine similarity search over the browser's chunks
    models.ts              # model IDs + retrieval settings
    types.ts                # shared UI message / citation types
```

## Important limitations (by design, for a demo)

- Documents live only in the visitor's browser tab and are gone on refresh.
  Search is a linear scan, which is fine for a few documents; for real usage,
  use a vector database (Postgres + pgvector, Pinecone, Turbopuffer, etc.).
- Uploads are capped at 4MB and about 30,000 words per request, and the API
  routes have best-effort per-IP rate limits. There is no authentication.

## Scripts

```bash
npm run dev     # start the dev server
npm run build   # production build (typechecks + lints as part of the build)
npm run lint    # run ESLint
npm run start   # run the production build
```
