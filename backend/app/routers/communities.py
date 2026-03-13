from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
from uuid import UUID, uuid4

from app.database.session import get_db
from app.auth.dependencies import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.community import (
    Community,
    CommunityVisibility,
    CommunityJoinRequest,
    CommunityMember,
    JoinRequestStatus,
    ModeratorInvite,
    CommunityBan,
)
from app.models.prompt import Prompt, PromptStatus
from app.models.tag import PromptTag
from app.schemas.communities import (
    CommunityCreate,
    CommunityUpdate,
    CommunityOut,
    JoinRequestOut,
    MembershipStatusOut,
    MemberOut,
    MemberRoleUpdate,
    ModeratorInviteCreate,
    BanCreate,
    BanOut,
)
from app.schemas.prompts import PromptCard
from app.models.notification import Notification, NotificationType
from app.schemas.common import PaginatedResponse
from app.config.settings import settings
from app.routers.uploads import _upload_to_supabase, ALLOWED_TYPES, AVATAR_MAX_SIZE

router = APIRouter(prefix="/communities", tags=["communities"])


async def _get_community_or_404(slug: str, db: AsyncSession) -> Community:
    result = await db.execute(select(Community).where(Community.slug == slug))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Community not found")
    return c


def _is_community_mod_or_owner(community: Community, user: User, db_member: CommunityMember | None) -> bool:
    if community.owner_id == user.id:
        return True
    return db_member is not None and db_member.role == "moderator"


async def _get_membership(community_id: UUID, user_id: UUID, db: AsyncSession) -> CommunityMember | None:
    result = await db.execute(
        select(CommunityMember).where(
            CommunityMember.community_id == community_id,
            CommunityMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def _is_banned(community_id: UUID, user_id: UUID, db: AsyncSession) -> bool:
    result = await db.execute(
        select(CommunityBan).where(
            CommunityBan.community_id == community_id,
            CommunityBan.user_id == user_id,
        )
    )
    return result.scalar_one_or_none() is not None


# ── List communities ──────────────────────────────────────────────────────────

@router.get("", response_model=list[CommunityOut])
async def list_communities(
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(Community).options(selectinload(Community.owner)).order_by(Community.title).limit(limit)
        )
        communities = result.scalars().all()
    except Exception as e:
        err_msg = str(e).strip()
        if "column" in err_msg.lower() and "does not exist" in err_msg.lower():
            raise HTTPException(
                status_code=500,
                detail=f"Database schema outdated: {err_msg}. Run: alembic upgrade head",
            )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load communities: {err_msg}",
        )
    if not communities:
        return []
    ids = [c.id for c in communities]
    try:
        count_result = await db.execute(
            select(CommunityMember.community_id, func.count(CommunityMember.user_id))
            .where(CommunityMember.community_id.in_(ids))
            .group_by(CommunityMember.community_id)
        )
        rows = count_result.all()
        counts = {row[0]: int(row[1]) for row in rows}
    except Exception as e:
        counts = {}
    return [
        CommunityOut.from_community(c, member_count=counts.get(c.id, 0))
        for c in communities
    ]


# ── Create community ──────────────────────────────────────────────────────────

@router.post("", response_model=CommunityOut, status_code=201)
async def create_community(
    payload: CommunityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(select(Community).where(Community.slug == payload.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug already taken")

    visibility = CommunityVisibility.restricted if (payload.visibility or "").strip().lower() == "restricted" else CommunityVisibility.public
    community = Community(
        id=uuid4(),
        owner_id=current_user.id,
        slug=payload.slug,
        title=payload.title,
        description=payload.description,
        rules=payload.rules,
        visibility=visibility,
    )
    db.add(community)
    await db.flush()
    db.add(
        CommunityMember(
            community_id=community.id,
            user_id=current_user.id,
            role="moderator",
        )
    )
    await db.commit()
    await db.refresh(community)
    return community


# ── Get community ─────────────────────────────────────────────────────────────

@router.get("/{slug}", response_model=CommunityOut)
async def get_community(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Community).options(selectinload(Community.owner)).where(Community.slug == slug)
    )
    community = result.scalar_one_or_none()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    count_result = await db.execute(
        select(func.count()).select_from(CommunityMember).where(CommunityMember.community_id == community.id)
    )
    member_count = count_result.scalar() or 0
    return CommunityOut.from_community(community, member_count=member_count)


@router.post("/{slug}/avatar", response_model=CommunityOut, status_code=201)
async def upload_community_avatar(
    slug: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload/update a community avatar. Owner or community moderator only."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Community avatar upload is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.",
        )

    community = await _get_community_or_404(slug, db)
    member = await _get_membership(community.id, current_user.id, db)
    if not _is_community_mod_or_owner(community, current_user, member):
        raise HTTPException(
            status_code=403,
            detail="Only the community owner or a moderator can change the community image",
        )

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=422,
            detail="File type not allowed. Use jpg, png, webp, or gif.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > AVATAR_MAX_SIZE:
        raise HTTPException(
            status_code=422,
            detail="File too large. Maximum size is 2MB.",
        )

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    storage_path = f"community-avatars/{community.id}/{uuid4()}.{ext}"
    public_url = await _upload_to_supabase(file_bytes, storage_path, file.content_type)

    community.avatar_url = public_url
    await db.commit()
    await db.refresh(community)
    count_result = await db.execute(
        select(func.count()).select_from(CommunityMember).where(CommunityMember.community_id == community.id)
    )
    return CommunityOut.from_community(community, member_count=count_result.scalar() or 0)


@router.post("/{slug}/banner", response_model=CommunityOut, status_code=201)
async def upload_community_banner(
    slug: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload/update community banner (cover image). Owner or moderator only."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Banner upload is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.",
        )
    community = await _get_community_or_404(slug, db)
    member = await _get_membership(community.id, current_user.id, db)
    if not _is_community_mod_or_owner(community, current_user, member):
        raise HTTPException(status_code=403, detail="Only the owner or a moderator can change the banner")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=422, detail="File type not allowed. Use jpg, png, webp, or gif.")
    file_bytes = await file.read()
    if len(file_bytes) > AVATAR_MAX_SIZE:
        raise HTTPException(status_code=422, detail="File too large. Maximum size is 2MB.")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    storage_path = f"community-banners/{community.id}/{uuid4()}.{ext}"
    public_url = await _upload_to_supabase(file_bytes, storage_path, file.content_type)
    community.banner_url = public_url
    await db.commit()
    await db.refresh(community)
    count_result = await db.execute(
        select(func.count()).select_from(CommunityMember).where(CommunityMember.community_id == community.id)
    )
    return CommunityOut.from_community(community, member_count=count_result.scalar() or 0)


# ── Update community ──────────────────────────────────────────────────────────

@router.patch("/{slug}", response_model=CommunityOut)
async def update_community(
    slug: str,
    payload: CommunityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    community = await _get_community_or_404(slug, db)
    member = await _get_membership(community.id, current_user.id, db)
    if not _is_community_mod_or_owner(community, current_user, member):
        raise HTTPException(status_code=403, detail="Only the community owner or a moderator can update this community")
    if payload.title is not None:
        community.title = payload.title
    if payload.description is not None:
        community.description = payload.description
    if payload.rules is not None:
        community.rules = payload.rules
    if payload.announcement is not None:
        community.announcement = payload.announcement
    if payload.show_owner_badge is not None:
        community.show_owner_badge = "true" if payload.show_owner_badge else "false"
    await db.commit()
    await db.refresh(community)
    count_result = await db.execute(
        select(func.count()).select_from(CommunityMember).where(CommunityMember.community_id == community.id)
    )
    return CommunityOut.from_community(community, member_count=count_result.scalar() or 0)


# ── Membership status (current user) ───────────────────────────────────────────

@router.get("/{slug}/membership", response_model=MembershipStatusOut)
async def get_my_membership(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    community = await _get_community_or_404(slug, db)
    if await _is_banned(community.id, current_user.id, db):
        return MembershipStatusOut(status="banned", role=None)
    member = await _get_membership(community.id, current_user.id, db)
    if member:
        return MembershipStatusOut(status=member.role, role=member.role)
    result = await db.execute(
        select(CommunityJoinRequest).where(
            CommunityJoinRequest.community_id == community.id,
            CommunityJoinRequest.user_id == current_user.id,
        ).order_by(CommunityJoinRequest.created_at.desc()).limit(1)
    )
    req = result.scalar_one_or_none()
    if req:
        return MembershipStatusOut(status=req.status, role=None)
    return MembershipStatusOut(status="none", role=None)


# ── Request to join ───────────────────────────────────────────────────────────

@router.post("/{slug}/join-request", status_code=201)
async def request_to_join(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    community = await _get_community_or_404(slug, db)
    if await _is_banned(community.id, current_user.id, db):
        raise HTTPException(status_code=403, detail="You are banned from this community")
    member = await _get_membership(community.id, current_user.id, db)
    if member:
        raise HTTPException(status_code=400, detail="You are already a member")
    result = await db.execute(
        select(CommunityJoinRequest)
        .where(
            CommunityJoinRequest.community_id == community.id,
            CommunityJoinRequest.user_id == current_user.id,
        )
        .order_by(CommunityJoinRequest.created_at.desc())
        .limit(1)
    )
    existing = result.scalar_one_or_none()
    if existing:
        if existing.status == "pending":
            raise HTTPException(status_code=400, detail="You already have a pending request")
        existing.status = "pending"
        existing.reviewed_by_id = None
        existing.reviewed_at = None
        await db.flush()
        # Notify owner and moderators on resubmit as well
        notify_user_ids = []
        if community.owner_id and community.owner_id != current_user.id:
            notify_user_ids.append(community.owner_id)
        mods_result = await db.execute(
            select(CommunityMember.user_id).where(
                CommunityMember.community_id == community.id,
                CommunityMember.role == "moderator",
                CommunityMember.user_id != current_user.id,
            )
        )
        for (uid,) in mods_result.all():
            if uid not in notify_user_ids:
                notify_user_ids.append(uid)
        for uid in notify_user_ids:
            db.add(
                Notification(
                    user_id=uid,
                    actor_id=current_user.id,
                    notification_type=NotificationType.community_join_request,
                    entity_type="community",
                    entity_id=community.id,
                    message=f"{current_user.username} requested to join c/{community.slug}",
                )
            )
        try:
            await db.commit()
        except Exception:
            await db.rollback()
            res = await db.execute(
                select(CommunityJoinRequest).where(CommunityJoinRequest.id == existing.id)
            )
            req_again = res.scalar_one_or_none()
            if req_again:
                req_again.status = "pending"
                req_again.reviewed_by_id = None
                req_again.reviewed_at = None
                await db.commit()
        return {"status": "pending", "message": "Join request resubmitted"}
    req = CommunityJoinRequest(
        id=uuid4(),
        community_id=community.id,
        user_id=current_user.id,
        status="pending",
    )
    db.add(req)
    await db.flush()
    # Notify owner and all moderators about the new join request
    notify_user_ids: list[UUID] = []
    if community.owner_id and community.owner_id != current_user.id:
        notify_user_ids.append(community.owner_id)
    mods_result = await db.execute(
        select(CommunityMember.user_id).where(
            CommunityMember.community_id == community.id,
            CommunityMember.role == "moderator",
            CommunityMember.user_id != current_user.id,
        )
    )
    for (uid,) in mods_result.all():
        if uid not in notify_user_ids:
            notify_user_ids.append(uid)
    for uid in notify_user_ids:
        db.add(
            Notification(
                user_id=uid,
                actor_id=current_user.id,
                notification_type=NotificationType.community_join_request,
                entity_type="community",
                entity_id=community.id,
                message=f"{current_user.username} requested to join c/{community.slug}",
            )
        )
    try:
        await db.commit()
    except Exception:
        # If commit fails (e.g. DB enum missing community_join_request), save only the join request
        await db.rollback()
        db.add(
            CommunityJoinRequest(
                id=req.id,
                community_id=community.id,
                user_id=current_user.id,
                status="pending",
            )
        )
        await db.commit()
    return {"status": "pending", "message": "Join request submitted"}


# ── List members (owner/moderator only) ───────────────────────────────────────

@router.get("/{slug}/members", response_model=list[MemberOut])
async def list_members(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    community = await _get_community_or_404(slug, db)
    member = await _get_membership(community.id, current_user.id, db)
    if not _is_community_mod_or_owner(community, current_user, member):
        raise HTTPException(status_code=403, detail="Only the owner or a moderator can view members")
    result = await db.execute(
        select(CommunityMember)
        .options(selectinload(CommunityMember.user))
        .where(CommunityMember.community_id == community.id)
        .order_by(CommunityMember.joined_at.asc())
    )
    members = result.scalars().all()
    return [
        MemberOut(
            user_id=m.user_id,
            username=m.user.username if m.user else "",
            role=m.role,
            joined_at=m.joined_at,
        )
        for m in members
    ]


# ── Invite as moderator (owner only; invitee can accept/reject) ──────────────────

@router.post("/{slug}/moderator-invite", status_code=201)
async def create_moderator_invite(
    slug: str,
    payload: ModeratorInviteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    community = await _get_community_or_404(slug, db)
    if community.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the community owner can invite moderators")
    member = await _get_membership(community.id, payload.user_id, db)
    if not member:
        raise HTTPException(status_code=400, detail="User must be a member before inviting as moderator")
    if member.role == "moderator":
        raise HTTPException(status_code=400, detail="User is already a moderator")
    existing = await db.execute(
        select(ModeratorInvite).where(
            ModeratorInvite.community_id == community.id,
            ModeratorInvite.user_id == payload.user_id,
            ModeratorInvite.status == "pending",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already has a pending moderator invite")
    inv = ModeratorInvite(
        id=uuid4(),
        community_id=community.id,
        user_id=payload.user_id,
        invited_by_id=current_user.id,
        status="pending",
    )
    db.add(inv)
    db.add(
        Notification(
            user_id=payload.user_id,
            actor_id=current_user.id,
            notification_type=NotificationType.moderator_invite,
            entity_type="community",
            entity_id=community.id,
            message=f"{current_user.username} invited you to be a moderator of c/{community.slug}",
        )
    )
    await db.commit()
    return {"id": inv.id, "status": "pending", "message": "Invite sent"}


@router.get("/{slug}/moderator-invites", response_model=list[dict])
async def list_moderator_invites(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List pending moderator invites for this community (owner only)."""
    community = await _get_community_or_404(slug, db)
    if community.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the community owner can list moderator invites")
    result = await db.execute(
        select(ModeratorInvite)
        .options(selectinload(ModeratorInvite.user))
        .where(
            ModeratorInvite.community_id == community.id,
            ModeratorInvite.status == "pending",
        )
    )
    invites = result.scalars().all()
    return [{"id": str(inv.id), "user_id": str(inv.user_id), "username": inv.user.username if inv.user else ""} for inv in invites]


# ── Set member role (owner only: revoke moderator → member) ────────────────────
# Only the community owner can revoke moderators. Adding moderators is via moderator-invite.

@router.patch("/{slug}/members/{user_id}", response_model=MemberOut)
async def set_member_role(
    slug: str,
    user_id: UUID,
    payload: MemberRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.role not in ("member", "moderator"):
        raise HTTPException(status_code=422, detail="role must be 'member' or 'moderator'")
    if payload.role == "moderator":
        raise HTTPException(
            status_code=400,
            detail="Use POST /communities/{slug}/moderator-invite to invite a moderator; they must accept.",
        )
    community = await _get_community_or_404(slug, db)
    if community.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the community owner can revoke or change member roles.",
        )
    result = await db.execute(
        select(CommunityMember)
        .options(selectinload(CommunityMember.user))
        .where(
            CommunityMember.community_id == community.id,
            CommunityMember.user_id == user_id,
        )
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    m.role = payload.role
    await db.commit()
    await db.refresh(m)
    return MemberOut(
        user_id=m.user_id,
        username=m.user.username if m.user else "",
        role=m.role,
        joined_at=m.joined_at,
    )


# ── Ban user (owner/moderator only) ───────────────────────────────────────────

@router.post("/{slug}/ban", status_code=201)
async def ban_user(
    slug: str,
    payload: BanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    community = await _get_community_or_404(slug, db)
    member = await _get_membership(community.id, current_user.id, db)
    if not _is_community_mod_or_owner(community, current_user, member):
        raise HTTPException(status_code=403, detail="Only the owner or a moderator can ban users")
    if community.owner_id == payload.user_id:
        raise HTTPException(status_code=400, detail="Cannot ban the community owner")
    mod_member = await _get_membership(community.id, payload.user_id, db)
    if mod_member and mod_member.role == "moderator":
        raise HTTPException(status_code=400, detail="Cannot ban a moderator; revoke moderator role first")
    if await _is_banned(community.id, payload.user_id, db):
        raise HTTPException(status_code=400, detail="User is already banned")
    # Remove from members if present
    await db.execute(
        delete(CommunityMember).where(
            CommunityMember.community_id == community.id,
            CommunityMember.user_id == payload.user_id,
        )
    )
    ban = CommunityBan(
        id=uuid4(),
        community_id=community.id,
        user_id=payload.user_id,
        banned_by_id=current_user.id,
        reason=payload.reason,
    )
    db.add(ban)
    # Notify the banned user
    db.add(
        Notification(
            user_id=payload.user_id,
            actor_id=current_user.id,
            notification_type=NotificationType.community_banned,
            entity_type="community",
            entity_id=community.id,
            message=f"You were banned from c/{community.slug}" + (f": {payload.reason}" if payload.reason else ""),
        )
    )
    await db.commit()
    return {"status": "banned", "user_id": str(payload.user_id)}


@router.get("/{slug}/bans", response_model=list[BanOut])
async def list_bans(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    community = await _get_community_or_404(slug, db)
    member = await _get_membership(community.id, current_user.id, db)
    if not _is_community_mod_or_owner(community, current_user, member):
        raise HTTPException(status_code=403, detail="Only the owner or a moderator can view bans")
    result = await db.execute(
        select(CommunityBan)
        .options(
            selectinload(CommunityBan.user),
            selectinload(CommunityBan.banned_by),
        )
        .where(CommunityBan.community_id == community.id)
        .order_by(CommunityBan.created_at.desc())
    )
    bans = result.scalars().all()
    return [
        BanOut(
            user_id=b.user_id,
            username=b.user.username if b.user else "",
            banned_by_username=b.banned_by.username if b.banned_by else "",
            reason=b.reason,
            created_at=b.created_at,
        )
        for b in bans
    ]


@router.delete("/{slug}/bans/{user_id}", status_code=204)
async def unban_user(
    slug: str,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    community = await _get_community_or_404(slug, db)
    member = await _get_membership(community.id, current_user.id, db)
    if not _is_community_mod_or_owner(community, current_user, member):
        raise HTTPException(status_code=403, detail="Only the owner or a moderator can unban users")
    result = await db.execute(
        select(CommunityBan).where(
            CommunityBan.community_id == community.id,
            CommunityBan.user_id == user_id,
        )
    )
    ban = result.scalar_one_or_none()
    if not ban:
        raise HTTPException(status_code=404, detail="User is not banned")
    await db.delete(ban)
    await db.commit()


# ── List pending join requests (owner/moderator only) ──────────────────────────

@router.get("/{slug}/join-requests", response_model=list[JoinRequestOut])
async def list_join_requests(
    slug: str,
    status: str = Query("pending", pattern="^(pending|approved|rejected)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    community = await _get_community_or_404(slug, db)
    member = await _get_membership(community.id, current_user.id, db)
    if not _is_community_mod_or_owner(community, current_user, member):
        raise HTTPException(status_code=403, detail="Only the community owner or a moderator can view join requests")
    result = await db.execute(
        select(CommunityJoinRequest)
        .options(selectinload(CommunityJoinRequest.user))
        .where(
            CommunityJoinRequest.community_id == community.id,
            CommunityJoinRequest.status == status,
        )
        .order_by(CommunityJoinRequest.created_at.desc())
    )
    requests = result.scalars().all()
    return [
        JoinRequestOut(
            id=r.id,
            user_id=r.user_id,
            username=r.user.username if r.user else "",
            status=r.status,
            created_at=r.created_at,
        )
        for r in requests
    ]


# ── Approve join request ──────────────────────────────────────────────────────

@router.post("/{slug}/join-requests/{request_id}/approve")
async def approve_join_request(
    slug: str,
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    community = await _get_community_or_404(slug, db)
    member = await _get_membership(community.id, current_user.id, db)
    if not _is_community_mod_or_owner(community, current_user, member):
        raise HTTPException(status_code=403, detail="Only the community owner or a moderator can approve requests")
    result = await db.execute(
        select(CommunityJoinRequest).where(
            CommunityJoinRequest.id == request_id,
            CommunityJoinRequest.community_id == community.id,
            CommunityJoinRequest.status == "pending",
        )
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Join request not found or already processed")
    req.status = "approved"
    req.reviewed_by_id = current_user.id
    req.reviewed_at = datetime.now(timezone.utc)
    db.add(CommunityMember(community_id=community.id, user_id=req.user_id, role="member"))
    db.add(
        Notification(
            user_id=req.user_id,
            actor_id=current_user.id,
            notification_type=NotificationType.community_join_approved,
            entity_type="community",
            entity_id=community.id,
            message=f"Your request to join c/{community.slug} was approved",
        )
    )
    await db.commit()
    return {"status": "approved", "message": "User has been added to the community"}


# ── Reject join request ───────────────────────────────────────────────────────

@router.post("/{slug}/join-requests/{request_id}/reject")
async def reject_join_request(
    slug: str,
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    community = await _get_community_or_404(slug, db)
    member = await _get_membership(community.id, current_user.id, db)
    if not _is_community_mod_or_owner(community, current_user, member):
        raise HTTPException(status_code=403, detail="Only the community owner or a moderator can reject requests")
    result = await db.execute(
        select(CommunityJoinRequest).where(
            CommunityJoinRequest.id == request_id,
            CommunityJoinRequest.community_id == community.id,
            CommunityJoinRequest.status == "pending",
        )
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Join request not found or already processed")
    req.status = "rejected"
    req.reviewed_by_id = current_user.id
    req.reviewed_at = datetime.now(timezone.utc)
    db.add(
        Notification(
            user_id=req.user_id,
            actor_id=current_user.id,
            notification_type=NotificationType.community_join_rejected,
            entity_type="community",
            entity_id=community.id,
            message=f"Your request to join c/{community.slug} was rejected",
        )
    )
    await db.commit()
    return {"status": "rejected", "message": "Join request rejected"}


# ── Community prompt feed ─────────────────────────────────────────────────────

@router.get("/{slug}/prompts", response_model=PaginatedResponse[PromptCard])
async def community_prompts(
    slug: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    sort: str = Query("recent", pattern="^(top|recent)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    community = await _get_community_or_404(slug, db)

    if current_user and await _is_banned(community.id, current_user.id, db):
        raise HTTPException(status_code=403, detail="You are banned from this community")

    if community.visibility == CommunityVisibility.restricted:
        if not current_user:
            raise HTTPException(
                status_code=403,
                detail="Join this community to view prompts. Sign in and request to join.",
            )
        member = await _get_membership(community.id, current_user.id, db)
        if not _is_community_mod_or_owner(community, current_user, member) and not member:
            raise HTTPException(
                status_code=403,
                detail="Join this community to view prompts. Request to join and wait for approval.",
            )

    from sqlalchemy.orm import selectinload
    stmt = (
        select(Prompt)
        .options(
            selectinload(Prompt.creator),
            selectinload(Prompt.prompt_tags).selectinload(PromptTag.tag),
            selectinload(Prompt.images),
        )
        .where(
            Prompt.community_id == community.id,
            Prompt.status == PromptStatus.published,
        )
    )

    if sort == "top":
        stmt = stmt.order_by(Prompt.score.desc(), Prompt.created_at.desc())
    else:
        stmt = stmt.order_by(Prompt.created_at.desc())

    total = (await db.execute(
        select(func.count()).select_from(
            select(Prompt).where(
                Prompt.community_id == community.id,
                Prompt.status == PromptStatus.published,
            ).subquery()
        )
    )).scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(stmt.offset(offset).limit(page_size))
    prompts = result.scalars().all()

    items = [
        PromptCard.model_validate({
            "id": p.id, "title": p.title, "model_family": p.model_family.value if p.model_family else None,
            "score": p.score, "creator": p.creator,
            "tags": [pt.tag for pt in p.prompt_tags],
            "images": p.images, "created_at": p.created_at,
        })
        for p in prompts
    ]

    return PaginatedResponse(items=items, total=total, page=page,
                             page_size=page_size, has_more=(offset + len(items)) < total)