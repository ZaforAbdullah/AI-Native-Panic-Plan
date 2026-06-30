from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
import auth

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.patch("/{session_id}/complete", response_model=schemas.StudySessionOut)
def complete_session(
    session_id: int,
    body: schemas.CompleteSessionRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    session = db.query(models.StudySession).join(models.ExamPlan).filter(
        models.StudySession.id == session_id,
        models.ExamPlan.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.completed = True
    session.comprehension_rating = body.comprehension_rating
    if body.user_note:
        session.user_note = body.user_note

    if body.comprehension_rating <= 2 and session.topic_id:
        review_date = (
            datetime.strptime(session.scheduled_date, "%Y-%m-%d").date() + timedelta(days=2)
        ).isoformat()
        review = models.StudySession(
            plan_id=session.plan_id,
            topic_id=session.topic_id,
            scheduled_date=review_date,
            duration_minutes=30,
            session_type="review",
            notes="Extra review added — you've got this, just needs another pass.",
        )
        db.add(review)

    db.commit()
    db.refresh(session)
    topic_name = session.topic.name if session.topic else None
    return schemas.StudySessionOut(
        id=session.id,
        plan_id=session.plan_id,
        topic_id=session.topic_id,
        topic_name=topic_name,
        scheduled_date=session.scheduled_date,
        duration_minutes=session.duration_minutes,
        session_type=session.session_type,
        notes=session.notes,
        user_note=session.user_note,
        completed=session.completed,
        comprehension_rating=session.comprehension_rating,
        is_missed=session.is_missed,
    )


@router.patch("/{session_id}/missed", response_model=schemas.StudySessionOut)
def mark_missed(
    session_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    session = db.query(models.StudySession).join(models.ExamPlan).filter(
        models.StudySession.id == session_id,
        models.ExamPlan.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.completed:
        raise HTTPException(400, "Cannot miss a completed session")

    session.is_missed = True
    chunk = session.duration_minutes // 3

    for i in range(1, 4):
        future_date = (
            datetime.strptime(session.scheduled_date, "%Y-%m-%d").date() + timedelta(days=i)
        ).isoformat()
        replacement = models.StudySession(
            plan_id=session.plan_id,
            topic_id=session.topic_id,
            scheduled_date=future_date,
            duration_minutes=chunk,
            session_type=session.session_type,
            notes="Life happened — we adjusted. Catch up at your own pace.",
        )
        db.add(replacement)

    db.commit()
    db.refresh(session)
    topic_name = session.topic.name if session.topic else None
    return schemas.StudySessionOut(
        id=session.id,
        plan_id=session.plan_id,
        topic_id=session.topic_id,
        topic_name=topic_name,
        scheduled_date=session.scheduled_date,
        duration_minutes=session.duration_minutes,
        session_type=session.session_type,
        notes=session.notes,
        user_note=session.user_note,
        completed=session.completed,
        comprehension_rating=session.comprehension_rating,
        is_missed=session.is_missed,
    )
