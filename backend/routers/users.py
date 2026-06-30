from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from database import get_db
import models
import schemas
import auth

router = APIRouter(prefix="/user", tags=["users"])


@router.get("/me")
def get_me(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    plan_count = (
        db.query(models.ExamPlan)
        .filter(models.ExamPlan.user_id == current_user.id)
        .count()
    )
    return {"id": current_user.id, "email": current_user.email, "plan_count": plan_count}


@router.patch("/password", status_code=200)
def change_password(
    body: schemas.ChangePasswordRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if not auth.verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    current_user.password_hash = auth.hash_password(body.new_password)
    db.commit()
    return {"ok": True}


@router.delete("", status_code=200)
def delete_account(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    db.delete(current_user)
    db.commit()
    return {"ok": True}


@router.get("/stats")
def get_stats(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    plans = (
        db.query(models.ExamPlan)
        .filter(models.ExamPlan.user_id == current_user.id)
        .options(selectinload(models.ExamPlan.sessions))
        .all()
    )

    all_sessions = [s for p in plans for s in p.sessions]
    completed = [s for s in all_sessions if s.completed]

    total_minutes = sum(s.duration_minutes for s in completed)

    completed_dates = sorted(
        {s.scheduled_date for s in completed},
        reverse=True
    )

    streak = 0
    today_str = date.today().isoformat()

    for i in range(len(completed_dates)):
        expected = (date.today() - timedelta(days=i)).isoformat()

        if i < len(completed_dates) and completed_dates[i] == expected:
            streak += 1
        elif expected == today_str:
            continue
        else:
            break

    studied_today = today_str in {
        s.scheduled_date for s in completed
    }

    sessions_this_week = sum(
        1
        for s in completed
        if (
            date.today()
            - date.fromisoformat(s.scheduled_date)
        ).days < 7
    )

    return {
        "total_plans": len(plans),
        "total_completed_sessions": len(completed),
        "total_minutes_studied": total_minutes,
        "streak_days": streak,
        "studied_today": studied_today,
        "sessions_this_week": sessions_this_week,
    }