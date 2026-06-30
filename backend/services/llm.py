import logging
import os
import random
import time

logger = logging.getLogger("panicplan.llm")


def _get_provider() -> str:
    return os.getenv("AI_PROVIDER", "gemini").lower()


_PROVIDER = _get_provider()


def _with_retry(fn, max_retries: int = 2, base_delay: float = 5.0):
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except Exception as exc:
            err = str(exc)
            if ("RESOURCE_EXHAUSTED" in err or "429" in err) and attempt < max_retries:
                delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                logger.warning(
                    "AI quota hit (attempt %d/%d), retrying in %.1fs",
                    attempt + 1, max_retries, delay,
                )
                time.sleep(delay)
            else:
                raise


def _get_model(temperature: float = 0.4, max_tokens: int | None = None):
    if _PROVIDER == "lmstudio":
        from langchain_openai import ChatOpenAI
        kwargs: dict = dict(
            model=os.getenv("LMSTUDIO_MODEL", "google/gemma-4-e4b"),
            api_key=os.getenv("LMSTUDIO_API_KEY", "lm-studio"),
            base_url=os.getenv("LMSTUDIO_BASE_URL", "http://localhost:1234/v1"),
            temperature=temperature,
        )
        if max_tokens:
            kwargs["max_tokens"] = max_tokens
        return ChatOpenAI(**kwargs)
    from langchain_google_genai import ChatGoogleGenerativeAI
    return ChatGoogleGenerativeAI(
        model=os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite"),
        google_api_key=os.getenv("GEMINI_API_KEY", ""),
        temperature=temperature,
    )


def _get_embeddings():
    if _PROVIDER == "lmstudio":
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(
            model=os.getenv("LMSTUDIO_EMBED_MODEL", "text-embedding-nomic-embed-text-v1.5"),
            api_key=os.getenv("LMSTUDIO_API_KEY", "lm-studio"),
            base_url=os.getenv("LMSTUDIO_BASE_URL", "http://localhost:1234/v1"),
            # LM Studio rejects tokenized integer arrays — send plain strings instead
            check_embedding_ctx_length=False,
        )
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    return GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=os.getenv("GEMINI_API_KEY", ""),
        output_dimensionality=768,  # matches pgvector(768) column in migrations
    )


def _get_callbacks() -> list:
    pk = os.getenv("LANGFUSE_PUBLIC_KEY")
    sk = os.getenv("LANGFUSE_SECRET_KEY")
    if not (pk and sk):
        return []
    try:
        from langfuse.callback import CallbackHandler
        return [CallbackHandler(public_key=pk, secret_key=sk)]
    except ImportError:
        return []
