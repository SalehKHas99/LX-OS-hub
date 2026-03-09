from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID, uuid4
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.database.session import get_db
from app.auth.dependencies import get_current_user, require_moderator
from app.models.user import User
from app.models.report import Report, ReportStatus

router = APIRouter(prefix="/reports", tags=["reports"])


class ReportCreate(BaseModel):
    entity_type: str   # prompt | comment | user
    entity_id: UUID
    reason: str
    notes: Optional[str] = None


class ReportOut(BaseModel):
    id: UUID
    reporter_id: UUID  # user who filed the report (from auth token)
    entity_type: str
    entity_id: UUID
    reason: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("", response_model=ReportOut, status_code=201)
async def file_report(
    payload: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = Report(
        id=uuid4(),
        reporter_id=current_user.id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        reason=payload.reason,
        notes=payload.notes,
        status=ReportStatus.pending,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


@router.get("/queue", response_model=list[ReportOut])
async def moderation_queue(
    db: AsyncSession = Depends(get_db),
    _mod: User = Depends(require_moderator),
):
    result = await db.execute(
        select(Report)
        .where(Report.status == ReportStatus.pending)
        .order_by(Report.created_at.asc())
    )
    return result.scalars().all()


@router.patch("/{report_id}/resolve", response_model=ReportOut)
async def resolve_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    _mod: User = Depends(require_moderator),
):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = ReportStatus.resolved
    await db.commit()
    await db.refresh(report)
    return report
