from datetime import date, datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from database import get_db
import models
import schemas
import auth
from services import ai as ai_engine
from services import rag
from services import vector_store

router = APIRouter(prefix="/plans", tags=["plans"])


def _build_plan_out(plan: models.ExamPlan) -> schemas.PlanOut:
    sessions_out = [
        schemas.StudySessionOut(
            id=s.id,
            plan_id=s.plan_id,
            topic_id=s.topic_id,
            topic_name=s.topic.name if s.topic else None,
            scheduled_date=s.scheduled_date,
            duration_minutes=s.duration_minutes,
            session_type=s.session_type,
            notes=s.notes,
            user_note=s.user_note,
            completed=s.completed,
            comprehension_rating=s.comprehension_rating,
            is_missed=s.is_missed,
        )
        for s in plan.sessions
    ]
    return schemas.PlanOut(
        id=plan.id,
        subject=plan.subject,
        exam_date=plan.exam_date,
        topics=plan.topics,
        created_at=plan.created_at,
        topic_records=[
            schemas.TopicOut(
                id=t.id,
                name=t.name,
                confidence=t.confidence,
                hours_allocated=t.hours_allocated,
            )
            for t in plan.topic_records
        ],
        sessions=sessions_out,
    )


@router.post("", response_model=schemas.PlanOut)
def create_plan(
    body: schemas.CreatePlanRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    plan = models.ExamPlan(
        user_id=current_user.id,
        subject=body.subject,
        exam_date=body.exam_date,
        topics=[t.model_dump() for t in body.topics],
    )
    db.add(plan)
    db.flush()

    topic_map = {}
    for t in body.topics:
        topic_rec = models.Topic(plan_id=plan.id, name=t.name, confidence=t.confidence)
        db.add(topic_rec)
        db.flush()
        topic_map[t.name] = topic_rec

    topic_list = [{"name": t.name, "confidence": t.confidence} for t in body.topics]
    ai_sessions = ai_engine.generate_schedule(
        subject=body.subject,
        exam_date=body.exam_date,
        topics=topic_list,
        daily_hours=body.daily_hours,
    )

    for s in ai_sessions:
        topic_rec = topic_map.get(s.get("topic_name"))
        session = models.StudySession(
            plan_id=plan.id,
            topic_id=topic_rec.id if topic_rec else None,
            scheduled_date=s.get("date"),
            duration_minutes=s.get("duration_minutes", 45),
            session_type=s.get("session_type", "learn"),
            notes=s.get("notes"),
        )
        db.add(session)
        if topic_rec:
            topic_rec.hours_allocated += s.get("duration_minutes", 45) / 60

    db.commit()
    db.refresh(plan)

    rag.ingest_plan_context(
        plan_id=plan.id,
        subject=plan.subject,
        topics=[{"name": t.name, "confidence": t.confidence} for t in body.topics],
    )
    vector_store.store_plan_embedding(
        plan_id=plan.id,
        subject=plan.subject,
        topics=[t.model_dump() for t in body.topics],
    )

    return _build_plan_out(plan)


@router.post("/from-sessions", response_model=schemas.PlanOut)
def save_plan_from_sessions(
    body: schemas.SavePlanRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    plan = models.ExamPlan(
        user_id=current_user.id,
        subject=body.subject,
        exam_date=body.exam_date,
        topics=[t.model_dump() for t in body.topics],
    )
    db.add(plan)
    db.flush()

    topic_map: dict[str, models.Topic] = {}
    for t in body.topics:
        topic_rec = models.Topic(plan_id=plan.id, name=t.name, confidence=t.confidence)
        db.add(topic_rec)
        db.flush()
        topic_map[t.name] = topic_rec

    for s in body.sessions:
        topic_rec = topic_map.get(s.topic_name)
        session = models.StudySession(
            plan_id=plan.id,
            topic_id=topic_rec.id if topic_rec else None,
            scheduled_date=s.date,
            duration_minutes=s.duration_minutes,
            session_type=s.session_type,
            notes=s.notes,
        )
        db.add(session)
        if topic_rec:
            topic_rec.hours_allocated += s.duration_minutes / 60

    db.commit()
    db.refresh(plan)

    vector_store.store_plan_embedding(
        plan_id=plan.id,
        subject=plan.subject,
        topics=[t.model_dump() for t in body.topics],
    )

    return _build_plan_out(plan)


@router.get("/similar")
def get_similar_plans(
    subject: str,
    current_user: models.User = Depends(auth.get_current_user),
):
    similar = vector_store.find_similar_plans(subject=subject, topics=[], k=3)
    return {"similar": similar}


@router.get("", response_model=List[schemas.PlanSummaryOut])
def list_plans(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    plans = (
        db.query(models.ExamPlan)
        .filter(models.ExamPlan.user_id == current_user.id)
        .order_by(models.ExamPlan.created_at.desc())
        .options(selectinload(models.ExamPlan.sessions))
        .all()
    )
    result = []
    for plan in plans:
        total = len(plan.sessions)
        completed = sum(1 for s in plan.sessions if s.completed)
        result.append(
            schemas.PlanSummaryOut(
                id=plan.id,
                subject=plan.subject,
                exam_date=plan.exam_date,
                created_at=plan.created_at,
                total_sessions=total,
                completed_sessions=completed,
            )
        )
    return result


@router.get("/{plan_id}", response_model=schemas.PlanOut)
def get_plan(
    plan_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    plan = (
        db.query(models.ExamPlan)
        .filter(models.ExamPlan.id == plan_id, models.ExamPlan.user_id == current_user.id)
        .options(
            selectinload(models.ExamPlan.sessions).selectinload(models.StudySession.topic),
            selectinload(models.ExamPlan.topic_records).selectinload(models.Topic.lesson),
        )
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return _build_plan_out(plan)


@router.get("/{plan_id}/public", response_model=schemas.PlanPublicOut)
def get_plan_public(plan_id: int, db: Session = Depends(get_db)):
    plan = (
        db.query(models.ExamPlan)
        .filter(models.ExamPlan.id == plan_id)
        .options(
            selectinload(models.ExamPlan.sessions),
            selectinload(models.ExamPlan.topic_records),
        )
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@router.delete("/{plan_id}", status_code=200)
def delete_plan(
    plan_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(models.ExamPlan).filter(
        models.ExamPlan.id == plan_id, models.ExamPlan.user_id == current_user.id
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    db.delete(plan)
    db.commit()
    return {"ok": True}


@router.post("/{plan_id}/reassess", response_model=schemas.PlanOut)
def reassess_plan(
    plan_id: int,
    body: schemas.ReassessRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(models.ExamPlan).filter(
        models.ExamPlan.id == plan_id, models.ExamPlan.user_id == current_user.id
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    topic_conf_map = {u.topic_id: u.new_confidence for u in body.topic_updates}
    for topic in plan.topic_records:
        if topic.id in topic_conf_map:
            topic.confidence = topic_conf_map[topic.id]

    today_str = date.today().isoformat()
    future_sessions = [
        s for s in plan.sessions
        if not s.completed and not s.is_missed and s.scheduled_date >= today_str
    ]
    for s in future_sessions:
        db.delete(s)
    db.flush()

    topic_list = [{"name": t.name, "confidence": t.confidence} for t in plan.topic_records]
    daily_hours = sum(t.hours_allocated for t in plan.topic_records) / max(
        (datetime.strptime(plan.exam_date, "%Y-%m-%d").date() - date.today()).days, 1
    )

    topic_map = {t.name: t for t in plan.topic_records}
    ai_sessions = ai_engine.regenerate_future_sessions(
        subject=plan.subject,
        exam_date=plan.exam_date,
        topics=topic_list,
        daily_hours=max(daily_hours, 1.0),
        from_date=today_str,
    )

    for s in ai_sessions:
        topic_rec = topic_map.get(s.get("topic_name"))
        new_session = models.StudySession(
            plan_id=plan.id,
            topic_id=topic_rec.id if topic_rec else None,
            scheduled_date=s.get("date"),
            duration_minutes=s.get("duration_minutes", 45),
            session_type=s.get("session_type", "review"),
            notes=s.get("notes"),
        )
        db.add(new_session)

    db.commit()
    db.refresh(plan)
    return _build_plan_out(plan)


@router.get("/{plan_id}/context")
def get_context(
    plan_id: int,
    q: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(models.ExamPlan).filter(
        models.ExamPlan.id == plan_id,
        models.ExamPlan.user_id == current_user.id,
    ).first()
    if not plan:
        raise HTTPException(404, "Plan not found")
    context = rag.retrieve_context(plan_id, q, k=5)
    return {"context": context}


@router.post("/{plan_id}/ingest")
def ingest_plan_content(
    plan_id: int,
    body: schemas.IngestContentRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(models.ExamPlan).filter(
        models.ExamPlan.id == plan_id,
        models.ExamPlan.user_id == current_user.id,
    ).first()
    if not plan:
        raise HTTPException(404, "Plan not found")
    rag.ingest_text(plan_id, body.content, source=body.source)
    return {"status": "ingested"}
