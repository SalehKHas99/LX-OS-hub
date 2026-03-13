import os
import uuid
from dataclasses import dataclass

import pytest
import httpx


# Ensure required settings exist for app import in tests.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

@pytest.fixture(scope="session")
def app():
    from app.main import app as fastapi_app
    return fastapi_app


@pytest.fixture()
def client(app):
    # Black-box integration client against a running API server.
    # This avoids asyncpg/loop issues that happen when running the app in-process.
    base_url = os.environ.get("TEST_BASE_URL", "http://127.0.0.1:8000")
    with httpx.Client(base_url=base_url, timeout=30.0) as c:
        r = c.get("/health")
        assert r.status_code == 200, f"API not reachable at {base_url}: {r.text}"
        yield c


def _rand_username(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


@dataclass
class TestUser:
    username: str
    email: str
    password: str
    access_token: str


@pytest.fixture()
def user_a(client) -> TestUser:
    username = _rand_username("uA")
    email = f"{username}@example.com"
    password = "StrongPass123!"
    r = client.post("/api/v1/auth/register", json={"username": username, "email": email, "password": password})
    assert r.status_code in (201, 400), r.text
    if r.status_code == 400:
        # extremely unlikely collision; retry once
        username = _rand_username("uA2")
        email = f"{username}@example.com"
        r = client.post("/api/v1/auth/register", json={"username": username, "email": email, "password": password})
        assert r.status_code == 201, r.text
    access = r.json()["access_token"]
    return TestUser(username=username, email=email, password=password, access_token=access)


@pytest.fixture()
def user_b(client) -> TestUser:
    username = _rand_username("uB")
    email = f"{username}@example.com"
    password = "StrongPass123!"
    r = client.post("/api/v1/auth/register", json={"username": username, "email": email, "password": password})
    assert r.status_code in (201, 400), r.text
    if r.status_code == 400:
        username = _rand_username("uB2")
        email = f"{username}@example.com"
        r = client.post("/api/v1/auth/register", json={"username": username, "email": email, "password": password})
        assert r.status_code == 201, r.text
    access = r.json()["access_token"]
    return TestUser(username=username, email=email, password=password, access_token=access)


@pytest.fixture()
def auth_headers_a(user_a: TestUser):
    return {"Authorization": f"Bearer {user_a.access_token}"}


@pytest.fixture()
def auth_headers_b(user_b: TestUser):
    return {"Authorization": f"Bearer {user_b.access_token}"}

