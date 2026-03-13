import pytest


def test_send_message_creates_notification_and_thread_openable(
    client, user_a, user_b, auth_headers_a, auth_headers_b
):
    # Resolve user ids
    me_a = client.get("/api/v1/auth/me", headers=auth_headers_a)
    me_b = client.get("/api/v1/auth/me", headers=auth_headers_b)
    assert me_a.status_code == 200
    assert me_b.status_code == 200
    a_id = me_a.json()["id"]
    b_id = me_b.json()["id"]

    # send message from A to B
    r = client.post(
        "/api/v1/messages",
        json={"recipient_id": b_id, "content": "hi from a"},
        headers=auth_headers_a,
    )
    assert r.status_code == 201, r.text
    msg = r.json()
    assert msg["recipient_id"] == b_id
    assert msg["is_from_me"] is True

    # recipient should see notification
    notif = client.get("/api/v1/notifications?unread_only=true&limit=20", headers=auth_headers_b)
    assert notif.status_code == 200, notif.text
    notifs = notif.json()
    assert any(n["notification_type"] == "message_received" and n["entity_type"] == "message_thread" and n["entity_id"] == a_id for n in notifs)

    # recipient can open thread (get messages with A) and see content
    thread = client.get(f"/api/v1/messages/with/{a_id}", headers=auth_headers_b)
    assert thread.status_code == 200, thread.text
    msgs = thread.json()
    assert any(m["content"] == "hi from a" for m in msgs)




