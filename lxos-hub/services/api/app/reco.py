"""
Recommendations engine MVP: tag overlap + quality weighting.
v2 hook: co-run collaborative filtering (placeholder).
"""
from app.db import get_conn


def get_recommendations(org_id: str, limit: int = 20,
                        ref_prompt_id: str | None = None) -> list[dict]:
    """
    Recommend prompts based on:
    1. Tag overlap with ref_prompt (if given), else user's most-run prompts
    2. Quality weighting: aggregate_score + fork_count + avg_rating
    3. Exclude prompts the user authored (within org)
    """
    with get_conn() as conn:
        with conn.cursor() as cur:

            # Get reference tags (from ref_prompt or org's most-run prompts)
            ref_tags: list[str] = []
            if ref_prompt_id:
                cur.execute("SELECT tag FROM prompt_tags WHERE prompt_id = %s", (ref_prompt_id,))
                ref_tags = [r[0] for r in cur.fetchall()]
            else:
                cur.execute("""
                    SELECT pt.tag, COUNT(*) as cnt
                    FROM runs r
                    JOIN prompt_versions pv ON pv.id = r.prompt_version_id
                    JOIN prompt_tags pt ON pt.prompt_id = pv.prompt_id
                    WHERE r.org_id = %s AND r.status = 'succeeded'
                    GROUP BY pt.tag ORDER BY cnt DESC LIMIT 10
                """, (org_id,))
                ref_tags = [r[0] for r in cur.fetchall()]

            # Build scored recommendation query
            if ref_tags:
                placeholders = ",".join(["%s"] * len(ref_tags))
                cur.execute(f"""
                    SELECT
                        p.id, p.title, p.description, p.category,
                        p.fork_count, p.avg_rating, p.aggregate_score,
                        COUNT(DISTINCT pt_match.tag) AS tag_overlap,
                        ARRAY_AGG(DISTINCT pt_all.tag) FILTER (WHERE pt_all.tag IS NOT NULL) AS tags
                    FROM prompts p
                    LEFT JOIN prompt_tags pt_match ON pt_match.prompt_id = p.id
                        AND pt_match.tag IN ({placeholders})
                    LEFT JOIN prompt_tags pt_all ON pt_all.prompt_id = p.id
                    WHERE (p.visibility = 'public' OR p.org_id = %s)
                    GROUP BY p.id
                    ORDER BY
                        (COUNT(DISTINCT pt_match.tag) * 2
                         + p.aggregate_score * 10
                         + p.fork_count * 0.5
                         + p.avg_rating) DESC,
                        p.created_at DESC
                    LIMIT %s
                """, ref_tags + [org_id, limit])
            else:
                # Fallback: pure quality ranking
                cur.execute("""
                    SELECT p.id, p.title, p.description, p.category,
                           p.fork_count, p.avg_rating, p.aggregate_score,
                           0 AS tag_overlap,
                           ARRAY_AGG(DISTINCT pt.tag) FILTER (WHERE pt.tag IS NOT NULL) AS tags
                    FROM prompts p
                    LEFT JOIN prompt_tags pt ON pt.prompt_id = p.id
                    WHERE p.visibility = 'public' OR p.org_id = %s
                    GROUP BY p.id
                    ORDER BY p.aggregate_score DESC, p.fork_count DESC, p.created_at DESC
                    LIMIT %s
                """, (org_id, limit))

            rows = cur.fetchall()
            return [
                {"id": str(r[0]), "title": r[1], "description": r[2], "category": r[3],
                 "fork_count": r[4], "avg_rating": float(r[5] or 0),
                 "aggregate_score": float(r[6] or 0),
                 "tag_overlap": r[7], "tags": r[8] or []}
                for r in rows
            ]
