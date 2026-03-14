def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "version" in data


def test_health_inprocess(client_inprocess):
    """In-process: no running server required."""
    r = client_inprocess.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert "version" in r.json()


def test_health_ready_ok(client_inprocess):
    """Readiness returns 200 when DB is reachable (mocked)."""
    from unittest.mock import AsyncMock, patch
    with patch("app.main.check_db_connectivity", new_callable=AsyncMock, return_value=True):
        r = client_inprocess.get("/health/ready")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data.get("db") == "connected"


def test_health_ready_fail(client_inprocess):
    """Readiness returns 503 when DB is unreachable (mocked)."""
    from unittest.mock import AsyncMock, patch
    with patch("app.main.check_db_connectivity", new_callable=AsyncMock, return_value=False):
        r = client_inprocess.get("/health/ready")
    assert r.status_code == 503
    data = r.json()
    assert data["status"] == "degraded"
    assert data.get("db") == "unreachable"


