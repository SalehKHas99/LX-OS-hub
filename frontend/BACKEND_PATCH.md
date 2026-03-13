# Backend patch needed for community wall posts

Add this file to: backend/app/routers/community_posts.py

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

from ..database.session import get_db
from ..auth.dependencies import get_current_user, get_current_user_optional
from ..models.user import User
from ..models.community import Community

router = APIRouter(prefix="/api/v1/communities", tags=["community-posts"])

# In-memory store for wall posts (replace with DB table in production)
# Structure: { slug: [ {id, content, author_id, author_username, created_at} ] }
_wall: dict = {}

class PostIn(BaseModel):
    content: str

@router.get("/{slug}/posts")
async def list_posts(slug: str, db: AsyncSession = Depends(get_db)):
    posts = _wall.get(slug, [])
    return {"items": list(reversed(posts)), "total": len(posts)}

@router.post("/{slug}/posts", status_code=201)
async def create_post(
    slug: str,
    body: PostIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Community).where(Community.slug == slug))
    community = result.scalar_one_or_none()
    if not community:
        raise HTTPException(404, "Community not found")
    
    if not body.content.strip():
        raise HTTPException(422, "Content cannot be empty")
    
    post = {
        "id": str(uuid.uuid4()),
        "content": body.content.strip(),
        "author": {"id": str(current_user.id), "username": current_user.username, "avatar_url": current_user.avatar_url},
        "created_at": datetime.utcnow().isoformat(),
    }
    _wall.setdefault(slug, []).append(post)
    return post
```

Then in backend/app/main.py, add:
```python
from .routers import community_posts
app.include_router(community_posts.router)
```
