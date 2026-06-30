from functools import lru_cache
import logging
import os
from typing import List, Dict, Any

from services.llm import _get_embeddings

logger = logging.getLogger("panicplan.vector_store")

@lru_cache(maxsize=1)
def _get_store():
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
        table_name="plan_embeddings",
        query_name="match_plan_embeddings",
    )


def store_plan_embedding(plan_id: int, subject: str, topics: List[Dict[str, Any]]) -> None:
    try:
        store = _get_store()
        text = f"{subject}: {', '.join(t['name'] for t in topics)}"
        store.add_texts(
            texts=[text],
            metadatas=[{"plan_id": plan_id, "subject": subject}],
            ids=[f"plan-{plan_id}"],
        )
    except Exception:
        logger.exception("Failed to store plan embedding (plan_id=%s)", plan_id)


def find_similar_plans(
    subject: str,
    topics: List[Dict[str, Any]],
    k: int = 3,
) -> List[Dict[str, Any]]:
    try:
        store = _get_store()
        query = f"{subject}: {', '.join(t['name'] for t in topics)}"
        docs = store.similarity_search(query, k=k)
        return [doc.metadata for doc in docs]
    except Exception:
        logger.exception("Failed to find similar plans")
        return []
