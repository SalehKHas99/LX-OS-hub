from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID, uuid4
from typing import Optional, List
from pydantic import BaseModel
import anthropic
import json

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.prompt import (
    Prompt,
    PromptContextBlock,
    PromptVersion,
    PromptStatus,
    ModelFamily,
    ContextSource,
    AdapterFamily,
)
from app.config.settings import settings

router = APIRouter(prefix="/lab", tags=["context-lab"])

# ── Xenon Engine System Prompt (the optimizer brain) ─────────────────────────

XENON_ENGINE_SYSTEM = """
ACTIVATE LX-OS (Enterprise) — Xenon Engine Prompt OS

ROLE
You are Xenon Engine: an enterprise-grade prompt operating system embedded inside LX-OS,
a community platform for AI artists. Your job is to parse, evaluate, and optimize
AI image generation prompts into structured context objects.

HARD CONSTRAINTS
1) Safety & policy compliance is absolute. Never assist with harmful content.
2) No stealth, no identity masking, no bypassing limits.
3) Never fabricate facts or invent prompt details that weren't implied by the original.
4) Always label assumptions explicitly.
5) Output MUST be valid JSON only — no prose, no markdown, no preamble.

CONTEXT FIELDS YOU MUST ANALYZE
- subject: The main entity or visual focus
- environment: Setting, place, weather, architecture, spatial context
- composition: Shot type, camera angle, framing, focal emphasis, depth cues
- lighting: Source, quality, mood, time of day, color temperature
- style: Art movement, medium, texture, rendering vocabulary, references
- camera_or_render: Lens cues, aspect ratio intent, render or photography feel
- mood: Emotional tone and narrative atmosphere
- color_palette: Primary palette guidance and contrast intent
- negative_prompt: Artifacts, exclusions, undesired elements
- model_parameters: Model-specific formatting, weights, stylize, chaos, seed, aspect ratio, steps
- notes_and_rationale: Why the prompt is structured this way

COMPLETENESS SCORING
Score each field 0-100. Overall completeness = average of all field scores.
- 0 = field completely missing
- 50 = field implied but vague
- 100 = field explicit and detailed

OPERATING PIPELINE (run every turn)

[INTAKE] Analyze the raw prompt — identify what's present, implied, and missing.
[COGNOS] Determine the most likely artistic intent.
[LOOM] Plan the structured output and what improvements would have highest impact.
[SYMPHONY] Generate: parsed blocks, completeness scores, suggestions, and adapter exports.
[PRISM] Verify output is valid JSON and all fields are accounted for.
[FINISHER] Return the final JSON object only.

OUTPUT FORMAT — return ONLY this JSON, nothing else:
{
  "context_blocks": [
    { "field_name": "subject", "field_value": "...", "confidence": 0-100 },
    { "field_name": "environment", "field_value": "...", "confidence": 0-100 },
    { "field_name": "composition", "field_value": "...", "confidence": 0-100 },
    { "field_name": "lighting", "field_value": "...", "confidence": 0-100 },
    { "field_name": "style", "field_value": "...", "confidence": 0-100 },
    { "field_name": "camera_or_render", "field_value": "...", "confidence": 0-100 },
    { "field_name": "mood", "field_value": "...", "confidence": 0-100 },
    { "field_name": "color_palette", "field_value": "...", "confidence": 0-100 },
    { "field_name": "negative_prompt", "field_value": "...", "confidence": 0-100 },
    { "field_name": "model_parameters", "field_value": "...", "confidence": 0-100 },
    { "field_name": "notes_and_rationale", "field_value": "...", "confidence": 0-100 }
  ],
  "completeness_score": 0-100,
  "missing_fields": ["list of field names scoring below 40"],
  "suggestions": [
    { "field": "...", "issue": "...", "recommendation": "..." }
  ],
  "assumptions": ["list of assumptions made during parsing"],
  "adapter_exports": {
    "midjourney": "full compiled prompt string for Midjourney",
    "dalle": "full compiled prompt string for DALL-E",
    "stable_diffusion": "full compiled prompt string for Stable Diffusion",
    "flux": "full compiled prompt string for Flux"
  }
}

If a field is genuinely absent and cannot be inferred, set field_value to "" and confidence to 0.
BEGIN EXECUTION NOW.
"""


# ── Request / Response schemas ────────────────────────────────────────────────

class ParseRequest(BaseModel):
    raw_prompt: str
    model_family: Optional[str] = None
    prompt_id: Optional[UUID] = None  # existing prompt; echoed in response when provided
    create_draft: bool = False  # when True, create a draft prompt and return its id in prompt_id


class ContextBlockResult(BaseModel):
    field_name: str
    field_value: str
    confidence: int


class Suggestion(BaseModel):
    field: str
    issue: str
    recommendation: str


class AdapterExports(BaseModel):
    midjourney: str
    dalle: str
    stable_diffusion: str
    flux: str


class ParseResponse(BaseModel):
    prompt_id: Optional[UUID] = None  # generated when create_draft=True, or echoed from request
    context_blocks: List[ContextBlockResult]
    completeness_score: int
    missing_fields: List[str]
    suggestions: List[Suggestion]
    assumptions: List[str]
    adapter_exports: AdapterExports


class SaveVersionRequest(BaseModel):
    prompt_id: UUID
    adapter_family: str
    compiled_prompt: str
    compile_notes: Optional[str] = None


class SaveVersionResponse(BaseModel):
    id: UUID
    prompt_id: UUID
    version_no: int
    adapter_family: str
    compiled_prompt: str
    compile_notes: Optional[str]


class OptimizeRequest(BaseModel):
    raw_prompt: str
    target_model: str
    goals: Optional[List[str]] = None
    prompt_id: Optional[UUID] = None  # existing prompt being optimized; echoed in response
    create_draft: bool = False  # when True and no prompt_id, create draft prompt and return its id


class OptimizeResponse(BaseModel):
    prompt_id: Optional[UUID] = None  # ID of the prompt that was optimized (when provided in request)
    original_prompt: str
    optimized_prompt: str
    completeness_before: int
    completeness_after: int
    changes_made: List[str]
    adapter_exports: AdapterExports


# ── Helper: call Claude with Xenon Engine brain ───────────────────────────────

async def _call_xenon(user_message: str) -> dict:
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    message = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=4096,
        system=XENON_ENGINE_SYSTEM,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = message.content[0].text.strip()

    # Strip markdown fences if model adds them
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return json.loads(raw)


# ── Endpoints ─────────────────────────────────────────────────────────────────

def _model_family_from_str(s: Optional[str]) -> ModelFamily:
    if not s:
        return ModelFamily.other
    try:
        return ModelFamily(s.strip().lower())
    except ValueError:
        return ModelFamily.other


@router.post("/parse", response_model=ParseResponse)
async def parse_prompt(
    payload: ParseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Parse a raw prompt into structured context blocks using Xenon Engine.
    Returns completeness score, missing fields, suggestions, and adapter exports.
    Set create_draft=True to create a draft prompt and get prompt_id in the response.
    """
    if len(payload.raw_prompt.strip()) < 10:
        raise HTTPException(status_code=422, detail="Prompt too short to parse")

    user_message = f"""Parse and analyze this AI image generation prompt:

PROMPT: {payload.raw_prompt}
TARGET MODEL: {payload.model_family or "generic"}

Extract all context fields, score completeness, identify missing elements,
and generate optimized adapter exports for all four model families."""

    try:
        result = await _call_xenon(user_message)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Xenon Engine returned invalid JSON")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    prompt_id = payload.prompt_id
    if payload.create_draft:
        title = (payload.raw_prompt[: 197] + "...") if len(payload.raw_prompt) > 200 else payload.raw_prompt
        prompt = Prompt(
            id=uuid4(),
            title=title or "Parsed prompt",
            raw_prompt=payload.raw_prompt,
            creator_id=current_user.id,
            model_family=_model_family_from_str(payload.model_family),
            status=PromptStatus.draft,
            score=0,
        )
        db.add(prompt)
        await db.flush()
        for i, cb in enumerate(result.get("context_blocks", [])):
            db.add(
                PromptContextBlock(
                    id=uuid4(),
                    prompt_id=prompt.id,
                    field_name=cb.get("field_name", "unknown"),
                    field_value=cb.get("field_value", ""),
                    source_type=ContextSource.ai_parsed,
                    confidence=cb.get("confidence"),
                    sort_order=i,
                )
            )
        await db.commit()
        prompt_id = prompt.id

    return ParseResponse(prompt_id=prompt_id, **result)


@router.post("/optimize", response_model=OptimizeResponse)
async def optimize_prompt(
    payload: OptimizeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Optimize a prompt for a specific target model using Xenon Engine.
    Returns the improved prompt, what changed, and completeness delta.
    Set create_draft=True to create a draft prompt from the optimized result and get prompt_id.
    """
    goals_str = ", ".join(payload.goals) if payload.goals else "maximize quality and completeness"

    user_message = f"""Optimize this AI image generation prompt for {payload.target_model}.

ORIGINAL PROMPT: {payload.raw_prompt}
TARGET MODEL: {payload.target_model}
OPTIMIZATION GOALS: {goals_str}

First parse the original to get completeness_before.
Then produce an improved version that fills gaps and maximizes the target model's strengths.
Return ONLY this JSON:
{{
  "original_prompt": "{payload.raw_prompt}",
  "optimized_prompt": "the improved full prompt string",
  "completeness_before": 0-100,
  "completeness_after": 0-100,
  "changes_made": ["list of specific improvements made"],
  "adapter_exports": {{
    "midjourney": "...",
    "dalle": "...",
    "stable_diffusion": "...",
    "flux": "..."
  }}
}}"""

    try:
        result = await _call_xenon(user_message)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Xenon Engine returned invalid JSON")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    prompt_id = payload.prompt_id
    if payload.create_draft:
        opt = result.get("optimized_prompt", "")
        title = (opt[: 197] + "...") if len(opt) > 200 else (opt or "Optimized prompt")
        prompt = Prompt(
            id=uuid4(),
            title=title,
            raw_prompt=opt,
            creator_id=current_user.id,
            model_family=_model_family_from_str(payload.target_model),
            status=PromptStatus.draft,
            score=0,
        )
        db.add(prompt)
        await db.commit()
        prompt_id = prompt.id

    return OptimizeResponse(prompt_id=prompt_id, **result)


@router.post("/save-version", response_model=SaveVersionResponse)
async def save_version(
    payload: SaveVersionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Save a compiled adapter export as a named version on a prompt.
    """
    result = await db.execute(
        select(Prompt).where(
            Prompt.id == payload.prompt_id,
            Prompt.status == PromptStatus.published,
        )
    )
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    if prompt.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your prompt")

    # Get next version number
    versions_result = await db.execute(
        select(PromptVersion).where(PromptVersion.prompt_id == payload.prompt_id)
    )
    existing = versions_result.scalars().all()
    next_version = len(existing) + 1

    version = PromptVersion(
        id=uuid4(),
        prompt_id=payload.prompt_id,
        version_no=next_version,
        adapter_family=payload.adapter_family,
        compiled_prompt=payload.compiled_prompt,
        compile_notes=payload.compile_notes,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)

    return SaveVersionResponse(
        id=version.id,
        prompt_id=version.prompt_id,
        version_no=version.version_no,
        adapter_family=version.adapter_family,
        compiled_prompt=version.compiled_prompt,
        compile_notes=version.compile_notes,
    )


@router.get("/versions/{prompt_id}", response_model=List[SaveVersionResponse])
async def get_versions(
    prompt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all saved versions for a prompt.
    """
    result = await db.execute(
        select(PromptVersion)
        .where(PromptVersion.prompt_id == prompt_id)
        .order_by(PromptVersion.version_no.asc())
    )
    versions = result.scalars().all()

    return [
        SaveVersionResponse(
            id=v.id,
            prompt_id=v.prompt_id,
            version_no=v.version_no,
            adapter_family=v.adapter_family,
            compiled_prompt=v.compiled_prompt,
            compile_notes=v.compile_notes,
        )
        for v in versions
    ]
