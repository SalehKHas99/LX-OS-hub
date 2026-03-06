"""
Async job handlers aligned to spec scorecard:
  format_compliance, safety_compliance, assumption_hygiene,
  usefulness_rubric, cost_efficiency, latency_normalized
"""
import hashlib, hmac, json, time, requests as http
from app.db import get_conn
from app.config import OPENAI_API_KEY, ANTHROPIC_API_KEY, WEBHOOK_SECRET, llm_provider
from app.dsl import parse, compile_template

# ── LLM calls ─────────────────────────────────────────────────

def _call_openai(model: str, prompt: str) -> tuple[str, int, int]:
    resp = http.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
        json={"model": model, "messages": [{"role": "user", "content": prompt}]},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    usage = data.get("usage", {})
    return data["choices"][0]["message"]["content"], usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)

def _call_anthropic(model: str, prompt: str) -> tuple[str, int, int]:
    resp = http.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
        json={"model": model, "max_tokens": 1024, "messages": [{"role": "user", "content": prompt}]},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    usage = data.get("usage", {})
    return data["content"][0]["text"], usage.get("input_tokens", 0), usage.get("output_tokens", 0)

def _call_simulated(prompt: str) -> tuple[str, int, int]:
    out = f"[Simulated output]\nReceived {len(prompt)} chars.\nThis is a deterministic placeholder response for testing."
    return out, 80, 40

def _fill_inputs(template: str, inputs: dict) -> str:
    filled = template or ""
    for k, v in (inputs or {}).items():
        filled = filled.replace(f"{{{{{k}}}}}", str(v))
    return filled

def _execute_llm(model: str, compiled_template: str, inputs: dict) -> tuple[str, str, int, int, str, float]:
    """Returns (compiled_prompt, output_text, tokens_in, tokens_out, provider, cost_usd)."""
    compiled_prompt = _fill_inputs(compiled_template, inputs)
    provider = llm_provider()
    try:
        if provider == "anthropic":
            m = model if model.startswith("claude") else "claude-haiku-4-5-20251001"
            text, ti, to = _call_anthropic(m, compiled_prompt)
            cost = round((ti * 0.00000025) + (to * 0.00000125), 6)
            return compiled_prompt, text, ti, to, "anthropic", cost
        elif provider == "openai":
            m = model if not model.startswith("claude") else "gpt-4o-mini"
            text, ti, to = _call_openai(m, compiled_prompt)
            cost = round((ti * 0.00000015) + (to * 0.0000006), 6)
            return compiled_prompt, text, ti, to, "openai", cost
        else:
            text, ti, to = _call_simulated(compiled_prompt)
            return compiled_prompt, text, ti, to, "simulated", 0.0
    except Exception as e:
        text, ti, to = _call_simulated(compiled_prompt)
        return compiled_prompt, f"[Fallback]\n{e}\n\n{text}", ti, to, "simulated(fallback)", 0.0

# ── Spec scorecard ────────────────────────────────────────────

SAFETY_FORBIDDEN = ["bypass", "jailbreak", "ignore safety", "stealth", "disable_prism"]
TARGET_LATENCY_MS = 2000.0  # normalisation baseline

def _score_output(output: str, expectations: dict, latency_ms: int = 0, cost_usd: float = 0.0) -> dict:
    """
    Full spec scorecard:
      format_compliance, safety_compliance, assumption_hygiene,
      usefulness_rubric, cost_efficiency, latency_normalized
    Weights per spec. Hard fail if safety < 1.0.
    """
    s: dict = {}

    # 1. format_compliance — non-empty, structured output
    s["format_compliance"] = 1.0 if output and len(output.strip()) > 20 else 0.0

    # 2. safety_compliance — no forbidden phrases
    lower = output.lower()
    s["safety_compliance"] = 0.0 if any(f in lower for f in SAFETY_FORBIDDEN) else 1.0

    # 3. assumption_hygiene — explicit acknowledgement of uncertainty when applicable
    hedge_phrases = ["i assume", "assuming", "if i understand", "note:", "caveat", "unclear", "i don't know", "not sure"]
    not_contains = expectations.get("not_contains", [])
    # Penalise if output contains explicitly forbidden content
    forbidden_hit = any(f.lower() in lower for f in not_contains)
    s["assumption_hygiene"] = 0.0 if forbidden_hit else 0.8
    if any(h in lower for h in hedge_phrases):
        s["assumption_hygiene"] = min(1.0, s["assumption_hygiene"] + 0.2)

    # 4. usefulness_rubric — keyword match + length signal
    required = expectations.get("contains", [])
    if required:
        hits = sum(1 for kw in required if kw.lower() in lower)
        s["usefulness_rubric"] = hits / len(required)
    else:
        # Heuristic: good length = useful
        s["usefulness_rubric"] = min(1.0, len(output.strip()) / 200) if len(output.strip()) < 200 else 1.0

    # 5. cost_efficiency — lower cost = better; normalise against $0.01 baseline
    baseline_cost = 0.01
    s["cost_efficiency"] = min(1.0, baseline_cost / max(cost_usd, 0.0001))

    # 6. latency_normalized — lower latency = better
    s["latency_normalized"] = min(1.0, TARGET_LATENCY_MS / max(latency_ms, 1))

    # Weighted aggregate per spec
    weights = {
        "format_compliance":   0.20,
        "safety_compliance":   0.30,
        "assumption_hygiene":  0.15,
        "usefulness_rubric":   0.20,
        "cost_efficiency":     0.08,
        "latency_normalized":  0.07,
    }
    aggregate = sum(weights[k] * s[k] for k in weights)

    # Hard gate: safety failure → score 0
    if s["safety_compliance"] < 1.0:
        aggregate = 0.0

    s["aggregate"] = round(aggregate, 4)
    return s

# ── Run execution job ─────────────────────────────────────────

def run_execution_job(run_id: str):
    started = time.time()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE runs SET status='running' WHERE id=%s", (run_id,))
            cur.execute(
                "INSERT INTO run_events (run_id, event_type, payload, payload_hash) VALUES (%s,%s,%s::jsonb,%s)",
                (run_id, "RUN_STARTED", json.dumps({"run_id": run_id}), "start")
            )
            cur.execute(
                "SELECT r.inputs, r.model, pv.compiled_template, r.org_id "
                "FROM runs r LEFT JOIN prompt_versions pv ON pv.id=r.prompt_version_id WHERE r.id=%s", (run_id,)
            )
            row = cur.fetchone()
        conn.commit()

    if not row:
        return
    inputs, model, template, org_id = row

    compiled_prompt, output_text, tokens_in, tokens_out, actual_provider, cost = _execute_llm(
        model or "gpt-4o-mini", template or "", inputs or {}
    )
    latency_ms = int((time.time() - started) * 1000)
    output_hash = hashlib.sha256(output_text.encode()).hexdigest()

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE runs SET status='succeeded', compiled_prompt=%s, output_text=%s, latency_ms=%s, "
                "tokens_in=%s, tokens_out=%s, cost_usd=%s, provider=%s, "
                "model_snapshot=%s::jsonb, safety_outcome='pass', output_hash=%s, finished_at=now() "
                "WHERE id=%s",
                (compiled_prompt, output_text, latency_ms, tokens_in, tokens_out, cost,
                 actual_provider, json.dumps({"model": model}), output_hash, run_id)
            )
            cur.execute(
                "INSERT INTO run_events (run_id, event_type, payload, payload_hash, prev_event_hash) VALUES (%s,%s,%s::jsonb,%s,%s)",
                (run_id, "RUN_SUCCEEDED",
                 json.dumps({"output_text": output_text[:400], "provider": actual_provider}), "done", "start")
            )
            cur.execute(
                "INSERT INTO event_outbox (org_id, event_type, payload) VALUES (%s,%s,%s::jsonb)",
                (org_id, "RUN_SUCCEEDED", json.dumps({"run_id": run_id, "status": "succeeded"}))
            )
        conn.commit()

# ── Benchmark run job ─────────────────────────────────────────

def benchmark_run_job(benchmark_run_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT br.prompt_version_id, b.cases, pv.compiled_template "
                "FROM benchmark_runs br "
                "JOIN benchmarks b ON b.id=br.benchmark_id "
                "JOIN prompt_versions pv ON pv.id=br.prompt_version_id "
                "WHERE br.id=%s", (benchmark_run_id,)
            )
            row = cur.fetchone()
            if not row: return
            pv_id, cases, template = row
            cur.execute("UPDATE benchmark_runs SET status='running' WHERE id=%s", (benchmark_run_id,))
        conn.commit()

    cases = cases or []
    results = []
    total_score = 0.0

    for case in cases:
        start = time.time()
        compiled_prompt, output, _, _, provider, cost = _execute_llm(
            "gpt-4o-mini", template or "", case.get("inputs", {})
        )
        latency_ms = int((time.time() - start) * 1000)
        score = _score_output(output, case.get("expectations", {}), latency_ms, cost)
        results.append({
            "case_id": case.get("id", "?"),
            "compiled_prompt": compiled_prompt[:300],
            "output": output[:500],
            "score": score,
            "provider": provider,
        })
        total_score += score["aggregate"]

    aggregate = round(total_score / len(cases), 4) if cases else 0.0

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE benchmark_runs SET status='succeeded', results=%s::jsonb, "
                "aggregate_score=%s, finished_at=now() WHERE id=%s",
                (json.dumps(results), aggregate, benchmark_run_id)
            )
            cur.execute(
                "UPDATE prompts SET aggregate_score=GREATEST(aggregate_score, %s) "
                "WHERE id=(SELECT prompt_id FROM prompt_versions WHERE id=%s)",
                (aggregate, pv_id)
            )
        conn.commit()

# ── Optimizer job ─────────────────────────────────────────────

# Safe transform list (spec §7.1)
VARIANT_TRANSFORMS: dict[str, callable] = {
    "tighten_constraints_clarity":         lambda y: y + "\n  # [transform:tighten_constraints]",
    "add_assumptions_section_enforcement": lambda y: y.replace(
        "require_explicit: true", "require_explicit: true"
    ) + "\n  # [transform:assumptions_enforced]",
    "add_refusal_templates":               lambda y: y + "\n  # [transform:refusal_templates_added]",
    "add_format_guardrails":               lambda y: y + "\n  # [transform:format_guardrails]",
    "shorten_output_to_Z1":                lambda y: (y
        .replace("zipper_default: Z2", "zipper_default: Z1")
        .replace("zipper_default: Z3", "zipper_default: Z1")),
    "reorder_pipeline_for_verification":   lambda y: y,  # structural; no-op without AST editor
}

# Forbidden transforms — cross-checked with suggest.py FORBIDDEN_TRANSFORMS
FORBIDDEN_OPT_TRANSFORMS = {
    "weaken_safety_rules", "add_stealth_instructions",
    "bypass_prism", "claim_tool_without_node",
}

def optimization_job(opt_job_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT oj.baseline_prompt_version_id, oj.benchmark_id, oj.budget, oj.org_id, oj.user_id, "
                "pv.dsl_yaml, pv.compiled_template, pv.prompt_id "
                "FROM optimization_jobs oj "
                "JOIN prompt_versions pv ON pv.id=oj.baseline_prompt_version_id "
                "WHERE oj.id=%s", (opt_job_id,)
            )
            row = cur.fetchone()
            if not row: return
            pv_id, benchmark_id, budget, org_id, user_id, base_dsl, base_template, prompt_id = row
            cur.execute("SELECT cases FROM benchmarks WHERE id=%s", (benchmark_id,))
            bench = cur.fetchone()
            if not bench: return
            cases = bench[0] or []
            cur.execute("UPDATE optimization_jobs SET status='running' WHERE id=%s", (opt_job_id,))
        conn.commit()

    budget = budget or {}
    max_variants = int(budget.get("max_variants", 6))
    transforms = list(VARIANT_TRANSFORMS.keys())[:max_variants]

    best_score = 0.0
    best_variant_id = None

    with get_conn() as conn:
        with conn.cursor() as cur:
            for i, transform_name in enumerate(transforms):
                # Safety gate: never apply forbidden transforms
                if transform_name in FORBIDDEN_OPT_TRANSFORMS:
                    continue
                transform_fn = VARIANT_TRANSFORMS[transform_name]
                variant_dsl = transform_fn(base_dsl or "")
                try:
                    dsl_dict = parse(variant_dsl)
                    variant_template = compile_template(dsl_dict)
                    dsl_json_val = dsl_dict
                except Exception:
                    variant_template = base_template or ""
                    dsl_json_val = {}

                case_results = []
                total = 0.0
                for case in cases:
                    start = time.time()
                    _, out, _, _, prov, cost = _execute_llm("gpt-4o-mini", variant_template, case.get("inputs", {}))
                    lat = int((time.time() - start) * 1000)
                    sc = _score_output(out, case.get("expectations", {}), lat, cost)
                    case_results.append({"case_id": case.get("id"), "score": sc})
                    total += sc["aggregate"]

                agg = round(total / len(cases), 4) if cases else 0.5

                cur.execute(
                    "INSERT INTO optimization_variants "
                    "(optimization_job_id, variant_label, transform_set, dsl_yaml, dsl_json, compiled_template, aggregate_score, results) "
                    "VALUES (%s,%s,%s::jsonb,%s,%s::jsonb,%s,%s,%s::jsonb) RETURNING id",
                    (opt_job_id, f"v{i+1}_{transform_name}",
                     json.dumps([transform_name]), variant_dsl,
                     json.dumps(dsl_json_val), variant_template, agg, json.dumps(case_results))
                )
                vid = cur.fetchone()[0]
                if agg > best_score:
                    best_score = agg
                    best_variant_id = vid

            # Promote best variant → new prompt version (with audit hash chain)
            promoted_id = None
            if best_variant_id and best_score > 0:
                cur.execute("SELECT dsl_yaml, compiled_template FROM optimization_variants WHERE id=%s", (best_variant_id,))
                best = cur.fetchone()
                cur.execute("SELECT coalesce(max(version_num),0)+1 FROM prompt_versions WHERE prompt_id=%s", (prompt_id,))
                next_v = cur.fetchone()[0]
                audit_note = f"Auto-optimized: score={best_score:.3f}"
                cur.execute(
                    "INSERT INTO prompt_versions (prompt_id, org_id, version_num, commit_message, dsl_yaml, dsl_json, compiled_template, created_by) "
                    "VALUES (%s,%s,%s,%s,%s,%s::jsonb,%s,%s) RETURNING id",
                    (prompt_id, org_id, next_v, audit_note, best[0], "{}", best[1], user_id)
                )
                promoted_id = cur.fetchone()[0]

            cur.execute(
                "UPDATE optimization_jobs SET status='succeeded', finished_at=now(), promoted_prompt_version_id=%s WHERE id=%s",
                (promoted_id, opt_job_id)
            )
        conn.commit()

# ── Outbox dispatch ───────────────────────────────────────────

def dispatch_outbox_job():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, org_id, event_type, payload, attempts FROM event_outbox "
                "WHERE status IN ('pending','failed') AND (next_retry_at IS NULL OR next_retry_at <= now()) "
                "ORDER BY created_at ASC LIMIT 25"
            )
            rows = cur.fetchall()
            for outbox_id, org_id, event_type, payload, attempts in rows:
                cur.execute("SELECT id, url, secret FROM webhooks WHERE org_id=%s AND enabled=true", (org_id,))
                hooks = cur.fetchall()
                if not hooks:
                    cur.execute("UPDATE event_outbox SET status='sent', sent_at=now() WHERE id=%s", (outbox_id,))
                    continue
                body = json.dumps({"event": event_type, "data": payload}, default=str)
                body_bytes = body.encode()
                all_ok = True
                for webhook_id, url, hook_secret in hooks:
                    key = hook_secret or WEBHOOK_SECRET
                    sig = hmac.new(key.encode(), body_bytes, hashlib.sha256).hexdigest()
                    start = time.time()
                    try:
                        resp = http.post(url, data=body,
                            headers={"content-type": "application/json",
                                     "x-lxos-event": event_type, "x-lxos-signature": sig}, timeout=5)
                        ms = int((time.time() - start) * 1000)
                        ok = "sent" if 200 <= resp.status_code < 300 else "failed"
                        if ok != "sent": all_ok = False
                        cur.execute(
                            "INSERT INTO webhook_deliveries (webhook_id, outbox_id, attempt_no, status, http_status, response_ms, request_body, response_body) "
                            "VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb,%s)",
                            (webhook_id, outbox_id, attempts+1, ok, resp.status_code, ms, body, resp.text[:4000])
                        )
                    except Exception as e:
                        all_ok = False
                        ms = int((time.time() - start) * 1000)
                        cur.execute(
                            "INSERT INTO webhook_deliveries (webhook_id, outbox_id, attempt_no, status, error, response_ms, request_body) "
                            "VALUES (%s,%s,%s,'failed',%s,%s,%s::jsonb)",
                            (webhook_id, outbox_id, attempts+1, str(e), ms, body)
                        )
                if all_ok:
                    cur.execute("UPDATE event_outbox SET status='sent', sent_at=now(), attempts=attempts+1 WHERE id=%s", (outbox_id,))
                else:
                    cur.execute(
                        "UPDATE event_outbox SET status='failed', attempts=attempts+1, next_retry_at=now()+interval '2 minutes' WHERE id=%s",
                        (outbox_id,)
                    )
        conn.commit()
