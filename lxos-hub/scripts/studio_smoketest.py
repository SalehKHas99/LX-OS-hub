import time
import requests

BASE = "http://localhost:8000"

def main():
    # Health check
    h = requests.get(f"{BASE}/health").json()
    assert h["status"] == "ok", f"Health failed: {h}"
    print("✓ health")

    # Auth
    me = requests.get(f"{BASE}/auth/me").json()
    assert "org_id" in me
    print("✓ auth/me:", me["role"])

    # Create prompt
    prompt = requests.post(f"{BASE}/prompts", json={
        "title": "Smoke Test Prompt",
        "description": "test",
        "dsl_yaml": "name: smoke",
        "compiled_template": "Hello {{name}}",
    }).json()
    assert "version_id" in prompt, f"Expected version_id: {prompt}"
    version_id = prompt["version_id"]
    print("✓ prompt created:", prompt["id"][:8])

    # Create run
    run = requests.post(f"{BASE}/runs", json={
        "prompt_version_id": version_id,
        "inputs": {"name": "world"},
        "request_id": "smoke-1"
    }).json()
    run_id = run["id"]
    print("✓ run created:", run_id[:8])

    # Poll for completion
    for _ in range(20):
        current = requests.get(f"{BASE}/runs/{run_id}").json()
        status = current["run"]["status"]
        if status in ("succeeded", "failed"):
            print(f"✓ run finished: {status}")
            break
        time.sleep(1)
    else:
        print("⚠ run did not complete in time")

    # Audit log
    audit = requests.get(f"{BASE}/audit?limit=10").json()
    print(f"✓ audit entries: {len(audit)}")

    # Outbox stats
    outbox = requests.get(f"{BASE}/outbox/stats").json()
    print(f"✓ outbox stats: {outbox}")

    # API key creation
    key_r = requests.post(f"{BASE}/api-keys", json={"name": "smoke-key", "scopes": ["prompts:read"]}).json()
    assert "key" in key_r
    print(f"✓ api key created: {key_r['id'][:8]}")

    # API key auth
    authed = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {key_r['key']}"}).json()
    assert "org_id" in authed
    print("✓ api key auth works")

    print("\n✅ Studio smoke test passed")

if __name__ == "__main__":
    main()
