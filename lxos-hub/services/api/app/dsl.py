"""
DSL parser, validator, and compiler for LX-OS prompt systems.
Converts YAML DSL → validated dict → compiled_template string.
"""
import hashlib
import yaml
from typing import Any

REQUIRED_FIELDS = ["lxos_version", "title"]
VALID_PIPELINE_TYPES = {"compose", "prism_verify", "assemble_output", "tool_call", "branch"}
VALID_ZIPPER_LEVELS = {"Z1", "Z2", "Z3"}
FORBIDDEN_INSTRUCTIONS = ["bypass", "stealth", "ignore_safety", "jailbreak", "disable_prism"]


class DSLValidationError(Exception):
    def __init__(self, errors: list[dict]):
        self.errors = errors
        super().__init__(str(errors))


def parse(dsl_yaml: str) -> dict:
    """Parse YAML string → dict. Raises ValueError on bad YAML."""
    try:
        data = yaml.safe_load(dsl_yaml)
        if not isinstance(data, dict):
            raise ValueError("DSL must be a YAML mapping")
        return data
    except yaml.YAMLError as e:
        raise ValueError(f"Invalid YAML: {e}")


def validate(dsl: dict) -> list[dict]:
    """
    Run deterministic lint rules.
    Returns list of suggestion dicts (severity: error|warning|info).
    """
    issues = []

    def issue(severity, code, title, rationale, patch=None):
        issues.append({"severity": severity, "id": code, "title": title, "rationale": rationale, "patch": patch})

    # Required fields
    for f in REQUIRED_FIELDS:
        if f not in dsl:
            issue("error", f"missing_{f}", f"Missing required field: {f}",
                  f"'{f}' is required in every LX-OS DSL file.")

    # Version check
    if "lxos_version" in dsl and str(dsl["lxos_version"]) not in ("0.1", "1.0"):
        issue("warning", "unknown_version", "Unrecognised lxos_version",
              "Supported versions: 0.1, 1.0")

    # Visibility
    ps = dsl.get("prompt_system", {})
    if not ps:
        issue("warning", "no_prompt_system", "No prompt_system block defined",
              "Add a prompt_system block with role and pipeline.")
    else:
        # Role
        role = ps.get("role", {})
        if not role.get("name"):
            issue("warning", "no_role_name", "Role has no name",
                  "Give the role a name for clarity and auditability.")
        if not role.get("instructions"):
            issue("warning", "no_role_instructions", "Role has no instructions",
                  "Add instructions to define assistant behaviour.")

        # Pipeline
        pipeline = ps.get("pipeline", [])
        if not pipeline:
            issue("warning", "empty_pipeline", "Pipeline is empty",
                  "Add at least one pipeline step (compose, prism_verify, assemble_output).")
        else:
            types = [s.get("type") for s in pipeline]
            has_verify = "prism_verify" in types
            has_compose = "compose" in types
            has_assemble = "assemble_output" in types

            if not has_compose:
                issue("warning", "no_compose_step", "No 'compose' step in pipeline",
                      "Add a compose step to generate the draft output.",
                      patch={"op": "insert_pipeline_step", "index": 0, "node": {"id": "draft", "type": "compose"}})
            if not has_verify:
                issue("warning", "missing_prism_verify", "No PRISM verification step",
                      "Add a prism_verify step after compose to gate format and safety.",
                      patch={"op": "insert_pipeline_step", "after": "compose", "node": {"id": "verify", "type": "prism_verify"}})
            if not has_assemble:
                issue("info", "no_assemble_step", "No 'assemble_output' step",
                      "Consider adding an assemble_output step as the final stage.")

            # Ordering: verify must come after compose
            if has_compose and has_verify:
                compose_idx = next((i for i, s in enumerate(pipeline) if s.get("type") == "compose"), 999)
                verify_idx = next((i for i, s in enumerate(pipeline) if s.get("type") == "prism_verify"), 999)
                if verify_idx < compose_idx:
                    issue("error", "verify_before_compose", "prism_verify is before compose",
                          "Verification must come after composition, not before.")

            # Unknown step types
            for step in pipeline:
                t = step.get("type", "")
                if t and t not in VALID_PIPELINE_TYPES:
                    issue("info", f"unknown_step_type_{t}", f"Unknown pipeline step type: {t}",
                          f"Known types: {', '.join(sorted(VALID_PIPELINE_TYPES))}")

        # Output package
        op = ps.get("output_package", {})
        zipper = op.get("zipper_default", "")
        if zipper and zipper not in VALID_ZIPPER_LEVELS:
            issue("warning", "invalid_zipper", f"Invalid zipper_default: {zipper}",
                  "Valid values: Z1 (concise), Z2 (expanded), Z3 (deep).")

    # Safety — forbidden instructions
    dsl_str = str(dsl).lower()
    for forbidden in FORBIDDEN_INSTRUCTIONS:
        if forbidden in dsl_str:
            issue("error", f"forbidden_{forbidden}", f"Forbidden instruction: '{forbidden}'",
                  "This instruction violates safety policy and cannot be used.")

    return issues


def compile_template(dsl: dict) -> str:
    """
    Produce a compiled template string — the skeleton prompt
    WITHOUT runtime inputs substituted in.
    """
    ps = dsl.get("prompt_system", {})
    role = ps.get("role", {})
    lines = []

    if role.get("name"):
        lines.append(f"# Role: {role['name']}")
    if role.get("instructions"):
        lines.append(role["instructions"].strip())

    policy = dsl.get("policy", {})
    safety = policy.get("safety", {})
    if safety.get("forbid"):
        lines.append("\n## Safety Constraints")
        for f in safety["forbid"]:
            lines.append(f"- NEVER: {f}")

    pipeline = ps.get("pipeline", [])
    if pipeline:
        lines.append("\n## Pipeline")
        for step in pipeline:
            lines.append(f"- [{step.get('type','?')}] {step.get('id','')}")

    op = ps.get("output_package", {})
    if op.get("zipper_default"):
        lines.append(f"\n## Output Format: {op['zipper_default']}")

    lines.append("\n## Input\n{{input}}")
    return "\n".join(lines)


def dsl_hash(dsl_yaml: str) -> str:
    return hashlib.sha256(dsl_yaml.encode()).hexdigest()[:16]
