from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TopicInput(BaseModel):
    name: str
    confidence: int


class CreatePlanRequest(BaseModel):
    subject: str
    exam_date: str
    topics: List[TopicInput]
    daily_hours: float


class TopicUpdate(BaseModel):
    topic_id: int
    new_confidence: int


class ReassessRequest(BaseModel):
    topic_updates: List[TopicUpdate]


class CompleteSessionRequest(BaseModel):
    comprehension_rating: int
    user_note: Optional[str] = None


class PrebuiltSessionInput(BaseModel):
    topic_name: str
    date: str
    duration_minutes: int
    session_type: str
    notes: Optional[str] = None


class SavePlanRequest(BaseModel):
    """Accepts a plan with pre-generated sessions from the Next.js streaming route."""
    subject: str
    exam_date: str
    topics: List[TopicInput]
    daily_hours: float
    sessions: List[PrebuiltSessionInput]


class StudySessionOut(BaseModel):
    id: int
    plan_id: int
    topic_id: Optional[int]
    topic_name: Optional[str]
    scheduled_date: str
    duration_minutes: int
    session_type: str
    notes: Optional[str]
    user_note: Optional[str]
    completed: bool
    comprehension_rating: Optional[int]
    is_missed: bool

    model_config = ConfigDict(from_attributes=True)


class TopicOut(BaseModel):
    id: int
    name: str
    confidence: int
    hours_allocated: float

    model_config = ConfigDict(from_attributes=True)


class PlanOut(BaseModel):
    id: int
    subject: str
    exam_date: str
    topics: list
    created_at: datetime
    topic_records: List[TopicOut] = []
    sessions: List[StudySessionOut] = []

    model_config = ConfigDict(from_attributes=True)


class PublicStudySessionOut(BaseModel):
    scheduled_date: str
    completed: bool
    is_missed: bool

    model_config = ConfigDict(from_attributes=True)


class PublicTopicOut(BaseModel):
    id: int
    name: str
    confidence: int

    model_config = ConfigDict(from_attributes=True)


class PlanPublicOut(BaseModel):
    id: int
    subject: str
    exam_date: str
    topic_records: List[PublicTopicOut] = []
    sessions: List[PublicStudySessionOut] = []

    model_config = ConfigDict(from_attributes=True)


class PlanSummaryOut(BaseModel):
    id: int
    subject: str
    exam_date: str
    created_at: datetime
    total_sessions: int
    completed_sessions: int

    model_config = ConfigDict(from_attributes=True)


class LessonOut(BaseModel):
    id: int
    topic_id: int
    summary: str
    key_concepts: list
    examples: list
    study_tip: Optional[str]
    common_mistakes: Optional[list]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FlashcardOut(BaseModel):
    id: int
    lesson_id: int
    front: str
    back: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatMessageOut(BaseModel):
    id: int
    plan_id: int
    role: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SaveChatMessageRequest(BaseModel):
    role: str
    content: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class IngestContentRequest(BaseModel):
    content: str
    source: str = "pdf"
