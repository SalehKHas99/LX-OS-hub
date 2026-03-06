"""
Search module: keyword (full-text + trigram) + tag/category filters + quality sort.
"""
from app.db import get_conn


def search_prompts(org_id: str, q: str = "", tags: str = "", category: str = "",
                   visibility: str = "", sort: str = "recent",
                   min_score: float = 0.0, limit: int = 40, offset: int = 0) -> list[dict]:
    """
    Unified search with full-text, tag filter, and sort.
    sort: recent | forks | rating | benchmark
    """
    conditions = ["(p.org_id = %s OR p.visibility = 'public')"]
    params: list = [org_id]

    if q:
        conditions.append(
            "(p.search_tsv @@ plainto_tsquery('english', %s) OR p.title ILIKE %s)"
        )
        params += [q, f"%{q}%"]

    if visibility:
        conditions.append("p.visibility = %s")
        params.append(visibility)

    if category:
        conditions.append("p.category = %s")
        params.append(category)

    if min_score > 0:
        conditions.append("p.aggregate_score >= %s")
        params.append(min_score)

    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    tag_join = ""
    if tag_list:
        placeholders = ",".join(["%s"] * len(tag_list))
        tag_join = f"""
          JOIN (
            SELECT prompt_id FROM prompt_tags
            WHERE tag IN ({placeholders})
            GROUP BY prompt_id HAVING count(*) = {len(tag_list)}
          ) tf ON tf.prompt_id = p.id
        """
        params = params[:1] + list(tag_list) + params[1:]  # inject after org_id

    sort_clause = {
        "forks":     "p.fork_count DESC, p.created_at DESC",
        "rating":    "p.avg_rating DESC, p.created_at DESC",
        "benchmark": "p.aggregate_score DESC, p.created_at DESC",
    }.get(sort, "p.created_at DESC")

    where = " AND ".join(conditions)
    sql = f"""
        SELECT p.id, p.title, p.description, p.visibility, p.category,
               p.fork_count, p.avg_rating, p.aggregate_score, p.created_at,
               ARRAY_AGG(DISTINCT pt.tag) FILTER (WHERE pt.tag IS NOT NULL) AS tags
        FROM prompts p
        {tag_join}
        LEFT JOIN prompt_tags pt ON pt.prompt_id = p.id
        WHERE {where}
        GROUP BY p.id
        ORDER BY {sort_clause}
        LIMIT %s OFFSET %s
    """
    params += [limit, offset]

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            return [
                {"id": str(r[0]), "title": r[1], "description": r[2],
                 "visibility": r[3], "category": r[4],
                 "fork_count": r[5], "avg_rating": float(r[6] or 0),
                 "aggregate_score": float(r[7] or 0),
                 "created_at": str(r[8]), "tags": r[9] or []}
                for r in rows
            ]
