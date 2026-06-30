import json
import logging
import re
from typing import Any

from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from services.llm import _PROVIDER, _get_callbacks, _get_model, _with_retry

logger = logging.getLogger("panicplan.lessons")

_LESSON_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are a brilliant private tutor who has helped hundreds of students go from average "
        "to top of their class. You never give generic textbook summaries. "
        "You explain the WHY and HOW, work through real problems step by step, and call out "
        "the exact mistakes students make. Respond with valid JSON only, no markdown.",
    ),
    (
        "human",
        """Create a deep, practical lesson on: {subject} — {topic}

This must be genuinely useful — not a Wikipedia summary. Write as if you're tutoring face-to-face.

Return JSON with exactly these fields:

{{
  "summary": "4-6 sentences. Cover: (1) what this topic actually IS at a mechanistic level — not a definition, the real explanation; (2) the key formula, principle, or process in plain language; (3) why examiners love to test it and what angle they usually take.",

  "key_concepts": [
    {{
      "concept": "Concept name — include the formula/equation/law if there is one",
      "explanation": "3-5 sentences. Explain HOW it works, not just what it is. Include: the mechanism or derivation in plain language, the specific conditions or limits where it applies, a concrete mini-example embedded in the explanation. Be specific — use actual names, numbers, formulas."
    }}
  ],

  "examples": [
    {{
      "question": "WORKED EXAMPLE: Write a realistic exam-style problem — the kind that actually appears on past papers. Include specific numbers, names, or scenarios.",
      "answer": "STEP-BY-STEP SOLUTION:\\nStep 1: [State what you identify/know]\\nStep 2: [Apply the principle/formula — show the working]\\nStep 3: [Calculate or reason to the answer]\\nAnswer: [Final result with units/context]\\n\\nKey insight: [The one thing this example teaches that students miss]"
    }}
  ],

  "study_tip": "MEMORY AID: [A specific mnemonic, acronym, or visualisation for THIS topic — not generic advice like 'make flashcards']\\n\\nEXAM TECHNIQUE: [Exactly what markers give marks for — what to always write, what to never skip]",

  "common_mistakes": [
    "WRONG: [Exactly how students misapply or misremember this] → CORRECT: [The precise correction and why the wrong version fails]"
  ]
}}

Rules: 3-5 key concepts. 2-3 worked examples. 2-3 common mistakes. Every field must be specific to THIS topic — zero generic advice.""",
    ),
])

_LESSON_PROMPT_COMPACT = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are an expert tutor. Explain reasoning and mechanisms. Respond with a single valid JSON object only. "
        "No markdown, no explanation before or after the JSON.",
    ),
    (
        "human",
        'Write a study lesson about the topic "{topic}" from the subject "{subject}". '
        'Return exactly this JSON structure with real content filled in:\n'
        '{{"summary":"2-3 sentences: what it is, key formula/mechanism, why examiners test it",'
        '"key_concepts":[{{"concept":"concept name","explanation":"how it works in 2 sentences"}}],'
        '"examples":[{{"question":"realistic exam question","answer":"step-by-step solution"}}],'
        '"study_tip":"specific memory technique for this topic",'
        '"common_mistakes":["one specific mistake students make"]}}\n'
        "Include 2-3 key_concepts and 1-2 examples. Be specific to this topic, not generic.",
    ),
])


def _parse_lesson_output(raw: str) -> dict[str, Any]:
    if not raw or not raw.strip():
        return {}

    text = raw.strip()

    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence_match:
        text = fence_match.group(1).strip()

    start = text.find("{")
    if start == -1:
        return {}
    text = text[start:]

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # try to recover truncated JSON by closing open brackets at the last valid boundary
    for end in range(len(text) - 1, 0, -1):
        if text[end] in ('"', ']', '}'):
            candidate = text[: end + 1]
            open_braces = candidate.count("{") - candidate.count("}")
            open_brackets = candidate.count("[") - candidate.count("]")
            candidate += "]" * max(open_brackets, 0) + "}" * max(open_braces, 0)
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue

    return {}


def generate_lesson(
    topic_name: str,
    subject: str,
    context: str = "",
    session_contexts: list[str] | None = None,
) -> dict[str, Any]:
    extra: list[str] = []
    if session_contexts:
        unique = list(dict.fromkeys(c.strip() for c in session_contexts if c and c.strip()))
        if unique:
            extra.append(
                "The study schedule for this topic covers these specific angles:\n"
                + "\n".join(f"• {c}" for c in unique[:6])
            )
    if context:
        extra.append(context)

    if _PROVIDER == "lmstudio":
        chain = _LESSON_PROMPT_COMPACT | _get_model(temperature=0.4, max_tokens=2000) | StrOutputParser()
        try:
            raw = chain.invoke(
                {"subject": subject, "topic": topic_name, "context": "\n\n".join(extra)},
                config={"callbacks": _get_callbacks()},
            )
            result = _parse_lesson_output(raw)
            if result:
                return result
        except Exception as exc:
            logger.warning("LM Studio lesson generation failed: %s", exc)
        return {
            "summary": (
                f"Study guide for {topic_name} in {subject}. "
                "Click 'Regenerate lesson' once your LM Studio model is loaded with "
                "a sufficient context window (set n_ctx ≥ 4096 in LM Studio settings)."
            ),
            "key_concepts": [],
            "examples": [],
            "study_tip": "Ask your AI tutor to explain this topic directly via the 💬 chat.",
            "common_mistakes": [],
        }

    def _invoke():
        chain = _LESSON_PROMPT | _get_model(temperature=0.4) | JsonOutputParser()
        return chain.invoke(
            {"subject": subject, "topic": topic_name, "context": "\n\n".join(extra)},
            config={"callbacks": _get_callbacks()},
        )

    return _with_retry(_invoke)
