import json
from datetime import date, datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
import models
import auth
from services import ai as ai_engine
from services import rag
from services.llm import _get_model, _get_callbacks
from config import CORS_HEADERS

router = APIRouter(prefix="/stream", tags=["streaming"])

_MAX_CHAT_MSG_LEN = 2_000


def _sanitize_message(text: str) -> str:
    cleaned = "".join(
        ch for ch in text
        if ch in ("\n", "\t") or (32 <= ord(ch) < 127 or ord(ch) > 160)
    )
    return cleaned[:_MAX_CHAT_MSG_LEN]


class StreamScheduleRequest(BaseModel):
    subject: str
    exam_date: str
    topics: list
    daily_hours: float


class StreamChatRequest(BaseModel):
    messages: list           # [{role, content}]
    plan_id: int
    subject: str
    exam_date: str
    topics: list
    topic_focus: str | None = None


@router.post("/schedule")
async def stream_schedule(body: StreamScheduleRequest):
    from langchain_core.output_parsers import StrOutputParser

    def _gen():
        try:
            chain = ai_engine._SCHEDULE_PROMPT | ai_engine._get_model() | StrOutputParser()
            for chunk in chain.stream(
                {
                    "subject": body.subject,
                    "exam_date": body.exam_date,
                    "today": date.today().isoformat(),
                    "topics": json.dumps(body.topics),
                    "daily_hours": body.daily_hours,
                },
                config={"callbacks": ai_engine._get_callbacks()},
            ):
                yield chunk
        except Exception as exc:
            err = str(exc)
            if "RESOURCE_EXHAUSTED" in err or "429" in err:
                yield "__ERROR__:quota_exceeded"
            elif "API_KEY" in err or "INVALID_ARGUMENT" in err:
                yield "__ERROR__:invalid_api_key"
            else:
                yield f"__ERROR__:{err[:300]}"

    return StreamingResponse(_gen(), media_type="text/plain", headers=CORS_HEADERS)


@router.post("/chat")
async def stream_chat(
    body: StreamChatRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.prompts import ChatPromptTemplate

    plan = db.query(models.ExamPlan).filter(
        models.ExamPlan.id == body.plan_id,
        models.ExamPlan.user_id == current_user.id,
    ).first()
    context = ""
    if plan:
        last_user_msg = next(
            (m["content"] for m in reversed(body.messages) if m.get("role") == "user"), ""
        )
        context = rag.retrieve_context(body.plan_id, last_user_msg, k=5)

    days_left = max(0, (
        datetime.strptime(body.exam_date, "%Y-%m-%d").date() - date.today()
    ).days)
    emojis = ["😰", "😟", "😐", "🙂", "💪"]
    topic_list = "\n".join(
        f"  • {t['name']} {emojis[min(t['confidence']-1, 4)]} ({t['confidence']}/5)"
        for t in body.topics
    )

    system = (
        f"You are an expert, encouraging study tutor for **{body.subject}** exam.\n"
        f"**Exam:** {days_left} day{'s' if days_left != 1 else ''} away ({body.exam_date})\n"
        + (f"**Current topic:** {body.topic_focus}\n" if body.topic_focus else "")
        + f"**Topics:**\n{topic_list}\n"
        + (f"\n**Relevant material:**\n---\n{context}\n---" if context else "")
        + "\nExplain clearly with examples. Quiz when asked. Be concise and exam-focused."
    )

    safe_messages = [
        (m["role"], _sanitize_message(m["content"]) if m.get("role") == "user" else m["content"])
        for m in body.messages[-8:]
    ]
    messages = [("system", system)] + safe_messages
    prompt = ChatPromptTemplate.from_messages(messages)
    model = _get_model(temperature=0.4)

    def _gen():
        try:
            for chunk in (prompt | model | StrOutputParser()).stream(
                {}, config={"callbacks": _get_callbacks()}
            ):
                yield chunk
        except Exception as exc:
            err = str(exc)
            if "RESOURCE_EXHAUSTED" in err or "429" in err:
                yield "__ERROR__:quota_exceeded"
            elif "API_KEY" in err or "INVALID_ARGUMENT" in err:
                yield "__ERROR__:invalid_api_key"
            else:
                yield f"__ERROR__:{err[:300]}"

    return StreamingResponse(_gen(), media_type="text/plain", headers=CORS_HEADERS)
