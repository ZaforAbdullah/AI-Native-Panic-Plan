import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
import auth
from services import lessons as lesson_svc
from services import flashcards as flashcard_svc
from services import rag

router = APIRouter(tags=["lessons"])


@router.post("/plans/{plan_id}/topics/{topic_id}/lesson", response_model=schemas.LessonOut)
def generate_lesson(
    plan_id: int,
    topic_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(models.ExamPlan).filter(
        models.ExamPlan.id == plan_id,
        models.ExamPlan.user_id == current_user.id,
    ).first()
    if not plan:
        raise HTTPException(404, "Plan not found")

    topic = db.query(models.Topic).filter(
        models.Topic.id == topic_id,
        models.Topic.plan_id == plan_id,
    ).first()
    if not topic:
        raise HTTPException(404, "Topic not found")

    existing = db.query(models.TopicLesson).filter(
        models.TopicLesson.topic_id == topic_id
    ).first()
    if existing:
        return existing

    session_contexts = [s.notes for s in topic.sessions if s.notes and s.notes.strip()]
    lesson_data = lesson_svc.generate_lesson(
        topic_name=topic.name,
        subject=plan.subject,
        session_contexts=session_contexts,
    )

    lesson = models.TopicLesson(
        topic_id=topic_id,
        summary=lesson_data.get("summary", ""),
        key_concepts=lesson_data.get("key_concepts", []),
        examples=lesson_data.get("examples", []),
        study_tip=lesson_data.get("study_tip"),
        common_mistakes=lesson_data.get("common_mistakes", []),
    )
    db.add(lesson)
    try:
        db.commit()
    except Exception:
        db.rollback()
        existing = db.query(models.TopicLesson).filter(
            models.TopicLesson.topic_id == topic_id
        ).first()
        if existing:
            return existing
        raise

    db.refresh(lesson)
    rag.ingest_lesson(plan_id, topic.name, lesson_data)
    return lesson


@router.get("/plans/{plan_id}/topics/{topic_id}/lesson", response_model=schemas.LessonOut)
def get_lesson(
    plan_id: int,
    topic_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    lesson = db.query(models.TopicLesson).filter(
        models.TopicLesson.topic_id == topic_id
    ).first()
    if not lesson:
        raise HTTPException(404, "Lesson not yet generated")
    return lesson


@router.delete("/plans/{plan_id}/topics/{topic_id}/lesson", status_code=200)
def delete_lesson(
    plan_id: int,
    topic_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(models.ExamPlan).filter(
        models.ExamPlan.id == plan_id,
        models.ExamPlan.user_id == current_user.id,
    ).first()
    if not plan:
        raise HTTPException(404, "Plan not found")
    lesson = db.query(models.TopicLesson).filter(
        models.TopicLesson.topic_id == topic_id
    ).first()
    if lesson:
        db.delete(lesson)
        db.commit()
    return {"ok": True}


@router.post("/lessons/{lesson_id}/flashcards", response_model=list[schemas.FlashcardOut])
def generate_lesson_flashcards(
    lesson_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    lesson = (
        db.query(models.TopicLesson)
        .join(models.Topic)
        .join(models.ExamPlan)
        .filter(
            models.TopicLesson.id == lesson_id,
            models.ExamPlan.user_id == current_user.id,
        )
        .first()
    )
    if not lesson:
        raise HTTPException(404, "Lesson not found")

    if lesson.flashcards:
        return lesson.flashcards

    cards_data = flashcard_svc.generate_flashcards(
        topic_name=lesson.topic.name,
        subject=lesson.topic.plan.subject,
        summary=lesson.summary,
        key_concepts=lesson.key_concepts or [],
    )

    db_cards = [
        models.Flashcard(lesson_id=lesson_id, front=c.get("front", ""), back=c.get("back", ""))
        for c in cards_data
        if c.get("front") and c.get("back")
    ]
    if db_cards:
        db.add_all(db_cards)
        db.commit()
        for c in db_cards:
            db.refresh(c)

    return db_cards


@router.get("/lessons/{lesson_id}/flashcards", response_model=list[schemas.FlashcardOut])
def get_lesson_flashcards(
    lesson_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    lesson = (
        db.query(models.TopicLesson)
        .join(models.Topic)
        .join(models.ExamPlan)
        .filter(
            models.TopicLesson.id == lesson_id,
            models.ExamPlan.user_id == current_user.id,
        )
        .first()
    )
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    return lesson.flashcards


@router.get("/plans/{plan_id}/review", response_model=list[schemas.FlashcardOut])
def plan_review_cards(
    plan_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(models.ExamPlan).filter(
        models.ExamPlan.id == plan_id,
        models.ExamPlan.user_id == current_user.id,
    ).first()
    if not plan:
        raise HTTPException(404, "Plan not found")

    cards: list[models.Flashcard] = []
    for topic in plan.topic_records:
        if topic.lesson and topic.lesson.flashcards:
            cards.extend(topic.lesson.flashcards)

    random.shuffle(cards)
    return cards
