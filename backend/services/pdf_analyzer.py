import io
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from services.llm import _get_model, _get_callbacks

_MAX_CHARS = 14000


def extract_text(file_bytes: bytes) -> tuple[str, int]:
    import pdfplumber
    parts: list[str] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages[:40]:  # cap at 40 pages
            text = page.extract_text()
            if text and text.strip():
                parts.append(text)
    return "\n\n".join(parts), page_count


_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are an expert academic coach who analyses study materials to create optimal learning plans. "
        "You deeply understand pedagogy, spaced repetition, and exam strategy. "
        "Always respond with valid JSON only, no markdown.",
    ),
    (
        "human",
        """Analyse this study material and extract a structured learning intelligence report.

Content:
{text}

Page count: {page_count}

Return JSON in exactly this format:
{{
  "subject": "Specific course/subject name (e.g. 'Organic Chemistry II', 'Linear Algebra')",
  "subject_type": "STEM|humanities|language|professional|other",
  "exam_date_hint": "YYYY-MM-DD if any date is explicitly mentioned, otherwise null",
  "daily_hours_suggestion": 2.5,
  "total_estimated_hours": 18,
  "difficulty_level": "beginner|intermediate|advanced",
  "document_type": "syllabus|lecture_notes|textbook|past_exam|mixed",
  "key_insight": "One sentence: the single most important study strategy for this material",
  "topics": [
    {{
      "name": "Topic name (2-6 words, concise)",
      "suggested_confidence": 1,
      "importance": "critical|high|medium|low",
      "description": "One sentence: what this covers and why it matters",
      "estimated_hours": 2.5
    }}
  ],
  "exam_tips": [
    "Specific tip 1 based on the material",
    "Specific tip 2",
    "Specific tip 3"
  ]
}}

Rules for topics:
- Extract 6–14 topics (merge micro-topics into coherent units)
- suggested_confidence default: 1 for complex new material, 2 for familiar basics
- importance levels: critical = almost certain to appear on exam; high = very likely; medium = supporting; low = background
- Order topics by optimal learning sequence (dependencies first)
- estimated_hours: time needed to understand the topic well (0.5–6 hours)
- total_estimated_hours: sum of all topic hours + review time
- daily_hours_suggestion: realistic for a student (1–5 hours/day)""",
    ),
])


def analyze(file_bytes: bytes) -> dict[str, Any]:
    text, page_count = extract_text(file_bytes)

    if len(text.strip()) < 80:
        raise ValueError(
            "Could not extract readable text from this PDF. "
            "Please upload a text-based PDF (not a scanned image)."
        )

    if len(text) > _MAX_CHARS:
        half = _MAX_CHARS // 2
        text = text[:half] + "\n\n...[middle sections omitted]...\n\n" + text[-half:]

    chain = _PROMPT | _get_model(temperature=0.2) | JsonOutputParser()
    result = chain.invoke(
        {"text": text, "page_count": page_count},
        config={"callbacks": _get_callbacks()},
    )
    return result
