-- PanicPlan vector store: pgvector tables backing services/vector_store.py
-- (cross-plan "similar plans" search) and services/rag.py (per-plan chat/lesson
-- RAG context). Embedding dim 768 matches both providers in use: Gemini's
-- gemini-embedding-001 (pinned to 768) and LM Studio's nomic-embed-text-v1.5.
--
-- Applied automatically on backend startup by main.py's _apply_sql_migrations()
-- when DATABASE_URL is Postgres — no manual step needed.

create extension if not exists vector;

-- ── Plan-level embeddings (one row per plan) ──────────────────────────────
-- Used by vector_store.py to find semantically similar past plans.
create table if not exists plan_embeddings (
  id text primary key,
  content text not null,
  metadata jsonb not null default '{}',
  embedding vector(768) not null
);

create index if not exists plan_embeddings_embedding_idx
  on plan_embeddings using hnsw (embedding vector_cosine_ops);

create or replace function match_plan_embeddings (
  query_embedding vector(768),
  filter jsonb default '{}'
) returns table (
  id text,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    plan_embeddings.id,
    plan_embeddings.content,
    plan_embeddings.metadata,
    1 - (plan_embeddings.embedding <=> query_embedding) as similarity
  from plan_embeddings
  where plan_embeddings.metadata @> filter
  order by plan_embeddings.embedding <=> query_embedding;
end;
$$;

-- ── Per-plan chunked documents (many rows per plan) ───────────────────────
-- Used by rag.py for chat/lesson context retrieval, scoped via metadata->>plan_id.
create table if not exists plan_documents (
  id text primary key,
  content text not null,
  metadata jsonb not null default '{}',
  embedding vector(768) not null
);

create index if not exists plan_documents_embedding_idx
  on plan_documents using hnsw (embedding vector_cosine_ops);

create index if not exists plan_documents_plan_id_idx
  on plan_documents using btree (((metadata->>'plan_id')::bigint));

create or replace function match_plan_documents (
  query_embedding vector(768),
  filter jsonb default '{}'
) returns table (
  id text,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    plan_documents.id,
    plan_documents.content,
    plan_documents.metadata,
    1 - (plan_documents.embedding <=> query_embedding) as similarity
  from plan_documents
  where plan_documents.metadata @> filter
  order by plan_documents.embedding <=> query_embedding;
end;
$$;
