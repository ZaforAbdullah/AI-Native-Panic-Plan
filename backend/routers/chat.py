from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
import auth

router = APIRouter(tags=["chat"])


@router.get("/plans/{plan_id}/chat", response_model=list[schemas.ChatMessageOut])
def get_chat(
    plan_id: int,
    limit: int = 50,
    offset: int = 0,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(models.ExamPlan).filter(
        models.ExamPlan.id == plan_id,
        models.ExamPlan.user_id == current_user.id,
    ).first()
    if not plan:
        raise HTTPException(404, "Plan not found")

    return (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.plan_id == plan_id)
        .order_by(models.ChatMessage.created_at)
        .offset(offset)
        .limit(min(limit, 200))
        .all()
    )


@router.post("/plans/{plan_id}/chat", response_model=schemas.ChatMessageOut)
def save_chat_message(
    plan_id: int,
    body: schemas.SaveChatMessageRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(models.ExamPlan).filter(
        models.ExamPlan.id == plan_id,
        models.ExamPlan.user_id == current_user.id,
    ).first()
    if not plan:
        raise HTTPException(404, "Plan not found")

    msg = models.ChatMessage(plan_id=plan_id, role=body.role, content=body.content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.delete("/plans/{plan_id}/chat", status_code=200)
def clear_chat(
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

    db.query(models.ChatMessage).filter(models.ChatMessage.plan_id == plan_id).delete()
    db.commit()
    return {"ok": True}
