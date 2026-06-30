import json
from datetime import date
from typing import List, Dict, Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from services.llm import _get_model, _get_callbacks, _with_retry


_SCHEDULE_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are an expert academic coach that creates realistic, effective study schedules. "
        "Always respond with valid JSON only, no markdown.",
    ),
    (
        "human",
        """Create a day-by-day study schedule for a university student.
Subject: {subject}
Exam date: {exam_date}
Today: {today}
Topics with confidence (1=not started, 5=solid): {topics}
Available study hours per day: {daily_hours}

Rules:
- Prioritize low-confidence topics heavily
- Space out review sessions using spaced repetition principles
- Leave the final day before the exam for light review only
- Each session should be 25-90 minutes
- Return JSON only in this exact format:
{{
  "sessions": [
    {{
      "topic_name": "string",
      "date": "YYYY-MM-DD",
      "duration_minutes": 45,
      "session_type": "learn",
      "notes": "one short coaching tip"
    }}
  ]
}}""",
    ),
])


def _run_chain(inputs: dict) -> List[Dict[str, Any]]:
    def _invoke():
        chain = _SCHEDULE_PROMPT | _get_model(temperature=0.3) | JsonOutputParser()
        return chain.invoke(inputs, config={"callbacks": _get_callbacks()})

    result = _with_retry(_invoke)
    if isinstance(result, dict):
        return result.get("sessions", [])
    return result if isinstance(result, list) else []


def generate_schedule(
    subject: str,
    exam_date: str,
    topics: List[Dict[str, Any]],
    daily_hours: float,
    today: str | None = None,
) -> List[Dict[str, Any]]:
    return _run_chain({
        "subject": subject,
        "exam_date": exam_date,
        "today": today or date.today().isoformat(),
        "topics": json.dumps(topics),
        "daily_hours": daily_hours,
    })


def regenerate_future_sessions(
    subject: str,
    exam_date: str,
    topics: List[Dict[str, Any]],
    daily_hours: float,
    from_date: str,
) -> List[Dict[str, Any]]:
    return generate_schedule(subject, exam_date, topics, daily_hours, today=from_date)
