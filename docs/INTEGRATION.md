# Messages, Profiles, Notifications & Communities — Integration

This doc summarizes how messages, user profiles, notifications, prompts, and communities are wired together.

## User profiles (`/u/[username]`)

- **GET /api/v1/users/{username}**: Public profile; `prompt_count` is filtered by `share_to_feed` when the viewer is not the profile owner (same as Explore).
- **GET /api/v1/users/{username}/prompts**: Paginated prompts; when the viewer is not the owner, only prompts with `share_to_feed=true` are returned.
- **PATCH /api/v1/users/me/profile**: Update own bio/avatar (authenticated).
- Profile page shows a **Message** button (to `/messages?with={user.id}`) when viewing another user.

## Messages (`/messages`)

- **GET /api/v1/messages/conversations**: List conversations with last message and per-conversation unread count.
- **GET /api/v1/messages/unread-count**: Total unread count (used for nav badge).
- **GET /api/v1/messages/with/{user_id}**: Thread with a user (paginated).
- **POST /api/v1/messages**: Send message; creates a `message_received` notification for the recipient.
- **POST /api/v1/messages/mark-read?user_id=**: Mark all messages from that user as read.
- Notification for new message uses `entity_type="message_thread"` and `entity_id=sender_id` so the link is `/messages?with={sender_id}`.

## Notifications

- **message_received**: Link to `/messages?with={entity_id}` (entity_id = sender).
- **community**, **prompt**, etc.: Use `entity_type` and `entity_id` / `entity_slug` for links.
- Each notification row shows **From: [actor_username]** linking to `/u/{actor_username}` when present.

## Cross-links in the UI

| From | To |
|------|----|
| Prompt card (feed/explore) | Creator name → `/u/{username}` |
| Prompt detail | Creator → `/u/{username}`, **Message** → `/messages?with={creator.id}` |
| Community sidebar | Owner name → `/u/{owner_username}` |
| Profile (other user) | **Message** → `/messages?with={user.id}` |
| Notification | Primary link by type; **From: actor** → `/u/{actor_username}` |
| Nav | Messages item shows unread badge (from `/messages/unread-count`). |

## Profile visibility rules

- **Own profile**: All published prompts; count = all published.
- **Other’s profile**: Only prompts with `share_to_feed=true`; count matches that set (aligned with Explore and search).
