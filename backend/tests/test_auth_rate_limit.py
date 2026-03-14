"""Auth rate limit: 429 after too many login/register attempts (in-process)."""
from app.auth.rate_limit import (
    AUTH_LIMIT,
    check_rate_limit,
    get_client_key,
    get_upload_rate_limit_key,
)


def test_rate_limit_allows_under_limit():
    key = "test-ip-1"
    for _ in range(AUTH_LIMIT - 1):
        assert check_rate_limit(key) is True
    assert check_rate_limit(key) is True  # last one still allowed


def test_rate_limit_blocks_over_limit():
    key = "test-ip-2"
    for _ in range(AUTH_LIMIT):
        check_rate_limit(key)
    assert check_rate_limit(key) is False


def test_rate_limit_get_client_key_forwarded():
    class Req:
        headers = {"X-Forwarded-For": " 1.2.3.4 , 5.6.7.8 "}
        client = None
    assert get_client_key(Req()) == "1.2.3.4"


def test_rate_limit_get_client_key_direct():
    class Req:
        headers = {}
        client = type("C", (), {"host": "127.0.0.1"})()
    assert get_client_key(Req()) == "127.0.0.1"


def test_upload_rate_limit_key_prefix():
    class Req:
        headers = {}
        client = type("C", (), {"host": "10.0.0.1"})()
    assert get_upload_rate_limit_key(Req()) == "upload:10.0.0.1"
