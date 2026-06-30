from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, JSON, Float, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    plans = relationship("ExamPlan", back_populates="user", cascade="all, delete-orphan")


class ExamPlan(Base):
    __tablename__ = "exam_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String, nullable=False)
    exam_date = Column(String, nullable=False)
    topics = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="plans")
    topic_records = relationship("Topic", back_populates="plan", cascade="all, delete-orphan")
    sessions = relationship("StudySession", back_populates="plan", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="plan", cascade="all, delete-orphan")


class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("exam_plans.id"), nullable=False)
    name = Column(String, nullable=False)
    confidence = Column(Integer, nullable=False)
    hours_allocated = Column(Float, default=0.0)

    plan = relationship("ExamPlan", back_populates="topic_records")
    sessions = relationship("StudySession", back_populates="topic")
    lesson = relationship("TopicLesson", back_populates="topic", uselist=False, cascade="all, delete-orphan")


class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("exam_plans.id"), nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    scheduled_date = Column(String, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    session_type = Column(String, nullable=False, default="learn")
    notes = Column(String, nullable=True)          # AI coaching tip
    user_note = Column(Text, nullable=True)        # Student's personal note after session
    completed = Column(Boolean, default=False)
    comprehension_rating = Column(Integer, nullable=True)
    is_missed = Column(Boolean, default=False)

    plan = relationship("ExamPlan", back_populates="sessions")
    topic = relationship("Topic", back_populates="sessions")


class TopicLesson(Base):
    """AI-generated lesson content for a single topic."""
    __tablename__ = "topic_lessons"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), unique=True, nullable=False)
    summary = Column(Text, nullable=False)
    key_concepts = Column(JSON, nullable=False)   # [{concept, explanation}]
    examples = Column(JSON, nullable=False)        # [{question, answer}]
    study_tip = Column(String, nullable=True)
    common_mistakes = Column(JSON, nullable=True)  # [str]
    created_at = Column(DateTime, default=datetime.utcnow)

    topic = relationship("Topic", back_populates="lesson")
    flashcards = relationship("Flashcard", back_populates="lesson", cascade="all, delete-orphan")


class Flashcard(Base):
    """AI-generated flip-card for rapid self-testing."""
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("topic_lessons.id"), nullable=False)
    front = Column(Text, nullable=False)  # question / term
    back = Column(Text, nullable=False)   # answer / explanation
    created_at = Column(DateTime, default=datetime.utcnow)

    lesson = relationship("TopicLesson", back_populates="flashcards")


class ChatMessage(Base):
    """Persisted chat history per plan (RAG tutor chat)."""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("exam_plans.id"), nullable=False)
    role = Column(String, nullable=False)   # "user" | "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    plan = relationship("ExamPlan", back_populates="chat_messages")
