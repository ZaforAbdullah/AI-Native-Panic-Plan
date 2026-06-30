# PanicPlan

Exam study scheduler with an AI-generated daily plan, per-topic lessons, RAG-backed tutor chat, and adaptive rescheduling. Built with FastAPI, Next.js, LangChain LCEL, and Supabase pgvector.

**[Live Demo](https://your-demo-url.vercel.app)** <!-- replace with your Vercel URL -->

---

## Features

**Streaming schedule generation** — Enter subject, exam date, topics, and confidence ratings (1–5). A LangChain LCEL chain streams raw JSON from Gemini to the browser in ~10 seconds. If the model truncates the output (token limit), the frontend detects the broken JSON and falls back to a non-streaming endpoint automatically.

**PDF upload** — Drop a lecture PDF; pdfplumber extracts the text, Gemini returns structured topic analysis (importance, difficulty, estimated hours per topic). Topics pre-fill the onboarding form — edit and generate.

**Per-topic lessons and flashcards** — Expanding a study session generates a full lesson on demand, cached on first load (UNIQUE constraint on `topic_id`). Flashcards are generated from lesson content and cached per session. Neither re-calls the AI on repeat views.

**RAG tutor chat** — Each plan has its own pgvector store seeded from lesson text and PDF chunks. Queries embed at request time, retrieve k=5 nearest chunks scoped to the plan, and inject them into the system prompt before streaming a reply. Chat history is persisted and loaded on open.

**Adaptive rescheduling** — Missed a session: duration split ÷ 3 across the next three available days. Rated comprehension ≤ 2: a 30-minute review session inserted two days out. No AI call — pure Python, runs in the same request.

**Reassessment** — Triggered automatically ≤ 3 days before the exam. Deletes incomplete future sessions, updates topic confidence from the latest ratings, and regenerates the remaining plan from today using the same schedule chain.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI 0.115, Python 3.12, SQLAlchemy 2, Alembic |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui |
| Database | Supabase Postgres (SQLAlchemy ORM) |
| Vector store | Supabase pgvector — `plan_documents` (RAG) + `plan_embeddings` (similarity) |
| AI | LangChain LCEL — Gemini (`gemini-3.1-flash-lite`) or LM Studio (local) |
| Auth | bcrypt + python-jose JWT (HS256, 24h) |

---

## Engineering decisions

**Streaming architecture**

Schedule generation streams raw JSON from an LCEL chain through Starlette `StreamingResponse` using a synchronous generator. LangChain's async iterator doesn't compose cleanly with Starlette's sync generator interface, so `.stream()` runs synchronously inside the generator. Errors caught inside the generator are yielded as `__ERROR__:<code>` tokens — the browser accumulates the full text and checks for these before attempting `JSON.parse`. If the model hits its token limit and the JSON is truncated, the frontend falls back to a non-streaming endpoint that regenerates the plan server-side.

The same error-token protocol is used in the chat stream (`/stream/chat`).

**Two pgvector tables for different retrieval patterns**

`plan_documents` stores lesson text and PDF chunks. Rows are scoped by `metadata->>'plan_id'` and queried via `match_plan_documents(query_embedding, plan_id, k=5)` for per-plan RAG. `plan_embeddings` stores one embedding per plan summary, used to surface similar past plans on the dashboard. Separating them avoids cross-contaminating plan content in similarity lookups.

Both tables use `vector(768)`. `gemini-embedding-001` and `nomic-embed-text-v1.5` both produce 768-dimensional vectors, so the migration works with either provider without schema changes.

**Provider switching via a single env var**

`AI_PROVIDER=gemini` injects `ChatGoogleGenerativeAI`; `AI_PROVIDER=lmstudio` injects `ChatOpenAI` pointed at `localhost:1234`. The same LCEL chains run against both. `_with_retry()` in `services/llm.py` wraps all AI calls with exponential backoff on `RESOURCE_EXHAUSTED` / 429 — the retry delay is capped to avoid hanging requests under sustained quota pressure.

**Frontend proxy routes**

Next.js `/api/generate` and `/api/chat` are thin JWT-forwarding proxies to FastAPI — no AI config, no business logic. The routes exist because streaming a response from the FastAPI backend directly from the browser would require CORS preflight on every chunk, and keeping the JWT out of query params means it can't be forwarded as a URL parameter. All model config and API keys stay server-side.

**Lesson and flashcard caching**

`topic_lessons` has a UNIQUE constraint on `topic_id`. The first request generates and writes; any concurrent request races to the same row, gets an `IntegrityError`, rolls back, and the retry reads the now-cached row. No application-level locking needed. Flashcards follow the same pattern on `(session_id, card_index)`.

**Adaptive rescheduling — no AI call**

Missed session: duration ÷ 3, distributed across the next 3 available days as new sessions. Comprehension rating ≤ 2: a 30-minute review session inserted 2 days out. Both paths are pure Python in `routers/sessions.py` — fast, deterministic, no quota cost.

Reassessment (triggered ≤ 3 days before the exam): delete all future incomplete sessions, update topic confidence scores from the latest ratings, call the AI schedule chain to regenerate from today. This is the only rescheduling path that hits the model.

---

## Request flow

```
Browser
  ↓ POST /api/generate (Next.js proxy)
  ↓ POST /stream/schedule (FastAPI)
      schedule_prompt | ChatGoogleGenerativeAI | StrOutputParser
      StreamingResponse — chunks to browser until JSON complete or __ERROR__:*
      fallback: POST /plans (non-streaming, full regeneration)

  ↓ POST /api/chat (Next.js proxy)
  ↓ POST /stream/chat (FastAPI)
      embed query → match_plan_documents(plan_id, k=5)
      chat_prompt + RAG context | model | StrOutputParser
      StreamingResponse
```

---

## Structure

```
panicplan/
├── backend/
│   ├── main.py               app init, CORS, request-ID middleware, SQL migrations
│   ├── models.py / schemas.py
│   ├── auth.py               bcrypt + python-jose
│   ├── database.py           engine + session factory
│   └── services/
│       ├── ai.py             schedule generation chain
│       ├── lessons.py        lesson chain + truncated-JSON recovery
│       ├── flashcards.py
│       ├── pdf_analyzer.py   pdfplumber + structured topic analysis
│       ├── rag.py            pgvector chunk/embed ingest + retrieval
│       ├── vector_store.py   plan-level similarity embeddings
│       └── llm.py            provider factory, _with_retry, embedding models
└── frontend/
    ├── app/
    │   ├── onboarding/       3-step wizard, streaming UI, parse-and-save flow
    │   ├── upload/           PDF drop + AI-prefilled topic confidence
    │   ├── dashboard/        plan list, streak, similar plans
    │   ├── plan/[id]/        sessions, inline lessons, timer, chat drawer, flashcards
    │   └── api/              generate + chat proxy routes
    ├── lib/api.ts            typed fetch client
    └── context/AuthContext.tsx
```

---

## Local setup

Requires Python ≥ 3.12, Node ≥ 20, [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
supabase start && supabase db push

cd panicplan/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000

cd panicplan/frontend
npm install && npm run dev
```

`supabase start` prints `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` — copy them into `backend/.env`.

---

## Docker

Supabase must be running first (either `supabase start` or a cloud project). The compose file reads `backend/.env` directly, so populate that file before building.

```bash
supabase start && supabase db push   # if running locally

docker compose up --build
```

Backend on `:8000`, frontend on `:3000`. The frontend container sets `NEXT_PUBLIC_API_URL=http://backend:8000` using Docker's internal DNS — if you need the browser to reach the API directly, override this in `docker-compose.yml` with the host-accessible URL.

The frontend image is a two-stage build: `node:24-alpine` compiles the Next.js standalone output, the runner stage copies only `.next/standalone`, `.next/static`, and `public`. The backend image is `python:3.12-slim` with no dev dependencies.

---

## Configuration

**`backend/.env`**

| Variable | Notes |
|---|---|
| `AI_PROVIDER` | `gemini` (default) or `lmstudio` |
| `GEMINI_API_KEY` | Required if `AI_PROVIDER=gemini` |
| `GEMINI_MODEL` | Default: `gemini-3.1-flash-lite` |
| `LMSTUDIO_BASE_URL` | Default: `http://localhost:1234/v1` |
| `LMSTUDIO_MODEL` | Model ID as shown in LM Studio |
| `LMSTUDIO_EMBED_MODEL` | Must produce 768-dim vectors to match the migration |
| `SECRET_KEY` | JWT signing key — use a random 32+ char string in production |
| `DATABASE_URL` | Postgres connection string from `supabase start` |
| `SUPABASE_URL` | Supabase project API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for pgvector writes via LangChain |
| `CORS_ORIGINS` | Comma-separated, default `http://localhost:3000` |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | Optional — LangChain call tracing |

**`frontend/.env.local`**

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```
