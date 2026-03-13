import uuid

import pytest


def test_auth_me(client, auth_headers_a):
    r = client.get("/api/v1/auth/me", headers=auth_headers_a)
    assert r.status_code == 200
    data = r.json()
    assert "id" in data and "username" in data


def test_create_community_and_list_has_member_count(client, auth_headers_a):
    slug = f"test-{uuid.uuid4().hex[:10]}"
    payload = {
        "title": "Test Community",
        "slug": slug,
        "description": "hello",
        "rules": "be nice",
        "visibility": "public",
    }
    r = client.post("/api/v1/communities", json=payload, headers=auth_headers_a)
    assert r.status_code in (201, 409), r.text
    if r.status_code == 409:
        # retry once
        slug = f"test-{uuid.uuid4().hex[:10]}"
        payload["slug"] = slug
        r = client.post("/api/v1/communities", json=payload, headers=auth_headers_a)
        assert r.status_code == 201, r.text
    community = r.json()
    assert community["slug"] == slug

    # list communities should not 500 and should include member_count as number
    r2 = client.get("/api/v1/communities")
    assert r2.status_code == 200, r2.text
    items = r2.json()
    assert isinstance(items, list)
    found = next((c for c in items if c["slug"] == slug), None)
    assert found is not None
    assert isinstance(found.get("member_count"), int)


def test_update_show_owner_badge_and_rules_limit(client, auth_headers_a):
    slug = f"badge-{uuid.uuid4().hex[:10]}"
    r = client.post(
        "/api/v1/communities",
        json={"title": "Badge Test", "slug": slug, "visibility": "public"},
        headers=auth_headers_a,
    )
    assert r.status_code == 201, r.text

    # toggle off
    r2 = client.patch(f"/api/v1/communities/{slug}", json={"show_owner_badge": False}, headers=auth_headers_a)
    assert r2.status_code == 200, r2.text
    assert r2.json()["show_owner_badge"] is False

    # rules too long -> 422 from pydantic validation
    too_long = "a" * 2001
    r3 = client.patch(f"/api/v1/communities/{slug}", json={"rules": too_long}, headers=auth_headers_a)
    assert r3.status_code in (422, 400), r3.text




