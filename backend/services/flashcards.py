import logging

from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from services.lessons import _parse_lesson_output
from services.llm import _PROVIDER, _get_callbacks, _get_model, _with_retry

logger = logging.getLogger("panicplan.flashcards")

_FLASHCARD_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are an expert exam tutor creating concise, exam-ready flashcards. "
        "Respond with valid JSON only, no markdown.",
    ),
    (
        "human",
        """Create 6 exam flashcards for: {subject} — {topic}

Use the lesson content:
Summary: {summary}
Key concepts: {concepts}

Mix card types:
1. Definition/concept → what it means + why it matters
2. Apply-the-rule → give a scenario, answer asks which rule applies
3. Common-mistake-correction → wrong belief on front, correction on back
4. Formula/process → term/formula on front, explanation on back

Return JSON:
{{"cards": [
  {{"front": "question or term", "back": "precise answer with 1 concrete example"}},
  ...6 total
]}}""",
    ),
])

_FLASHCARD_PROMPT_COMPACT = ChatPromptTemplate.from_messages([
    ("system", "Exam tutor. JSON only."),
    ("human", 'Make 4 flashcards for "{topic}" ({subject}).\n'
               '{{"cards":[{{"front":"question","back":"answer"}}]}}'),
])


def generate_flashcards(
    topic_name: str,
    subject: str,
    summary: str,
    key_concepts: list,
) -> list[dict[str, str]]:
    concepts_text = "; ".join(
        f"{kc.get('concept', '')}: {kc.get('explanation', '')}" for kc in (key_concepts or [])
    )

    if _PROVIDER == "lmstudio":
        chain = _FLASHCARD_PROMPT_COMPACT | _get_model(temperature=0.5, max_tokens=1800) | StrOutputParser()
        try:
            raw = chain.invoke(
                {"topic": topic_name, "subject": subject},
                config={"callbacks": _get_callbacks()},
            )
            parsed = _parse_lesson_output(raw)
            if parsed and "cards" in parsed:
                return parsed["cards"]
        except Exception:
            pass
        return []

    def _invoke():
        chain = _FLASHCARD_PROMPT | _get_model(temperature=0.5) | JsonOutputParser()
        return chain.invoke(
            {"subject": subject, "topic": topic_name, "summary": summary, "concepts": concepts_text},
            config={"callbacks": _get_callbacks()},
        )

    try:
        result = _with_retry(_invoke)
        return result.get("cards", [])
    except Exception as exc:
        logger.warning("Flashcard generation failed: %s", exc)
        return []
