import logging
import os
from functools import lru_cache

from services.llm import _get_embeddings

logger = logging.getLogger("panicplan.rag")


@lru_cache(maxsize=1)
def _document_store():
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not (supabase_url and supabase_key):
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")

    from supabase import create_client
    from langchain_community.vectorstores import SupabaseVectorStore
    client = create_client(supabase_url, supabase_key)
    return SupabaseVectorStore(
        client=client,
        embedding=_get_embeddings(),
        table_name="plan_documents",
        query_name="match_plan_documents",
    )


def ingest_text(plan_id: int, text: str, source: str, topic_name: str = "") -> None:
    if not text or not text.strip():
        return
    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=80)
        chunks = splitter.split_text(text)
        store = _document_store()
        metadatas = [{"source": source, "topic": topic_name, "plan_id": plan_id} for _ in chunks]
        ids = [f"{plan_id}-{source}-{topic_name}-{i}" for i in range(len(chunks))]
        store.add_texts(texts=chunks, metadatas=metadatas, ids=ids)
        logger.debug("Ingested %d chunks for plan %s [source=%s]", len(chunks), plan_id, source)
    except Exception as exc:
        logger.warning("Supabase ingest failed (non-critical): %s", exc)


def ingest_lesson(plan_id: int, topic_name: str, lesson: dict) -> None:
    parts = [lesson.get("summary", "")]
    for kc in lesson.get("key_concepts", []):
        parts.append(f"{kc.get('concept')}: {kc.get('explanation')}")
    for ex in lesson.get("examples", []):
        parts.append(f"Q: {ex.get('question')}\nA: {ex.get('answer')}")
    full_text = "\n\n".join(p for p in parts if p)
    ingest_text(plan_id, full_text, source="lesson", topic_name=topic_name)


def ingest_plan_context(plan_id: int, subject: str, topics: list[dict]) -> None:
    lines = [f"Subject: {subject}", "Topics and confidence:"]
    for t in topics:
        lines.append(f"  • {t['name']} (confidence {t['confidence']}/5)")
    ingest_text(plan_id, "\n".join(lines), source="summary")


def retrieve_context(plan_id: int, query: str, k: int = 5) -> str:
    try:
        store = _document_store()
        docs = store.similarity_search(query, k=k, filter={"plan_id": plan_id})
        return "\n\n---\n\n".join(d.page_content for d in docs)
    except Exception as exc:
        logger.warning("RAG retrieval failed (plan=%s, query=%s): %s", plan_id, query[:200], exc)
        return ""


def delete_plan_store(plan_id: int) -> None:
    try:
        store = _document_store()
        store._client.from_(store.table_name).delete().filter(
            "metadata->>plan_id", "eq", str(plan_id)
        ).execute()
    except Exception:
        pass
