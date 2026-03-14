# Profiles & Messages — Full Wiring

This document lists how **user profiles** and the **messages system** are wired across the app so you can verify everything is live.

## Backend (must be running)

- **Profiles:** `GET /api/v1/users/{username}`, `GET /api/v1/users/{username}/prompts`, `PATCH /api/v1/users/me/profile`
- **Messages:** `GET /api/v1/messages/unread-count`, `GET /api/v1/messages/conversations`, `GET /api/v1/messages/with/{user_id}`, `POST /api/v1/messages`, `POST /api/v1/messages/mark-read`
- **Notifications:** `GET /api/v1/notifications` (includes `entity_type: "message_thread"`, `entity_id` = sender id for message notifications)

## Frontend routes

| Path | Page | Auth |
|------|------|------|
| `/u/:username` | ProfilePage | Public |
| `/messages` | MessagesPage | Required |

## Where profiles and messages appear

### Sidebar (AppShell)

- **Messages** — Nav item; unread badge when logged in.
- **My profile** — Nav item when logged in (links to `/u/{your_username}`).
- **User block (avatar + username)** — Click goes to your profile (`/u/{username}`).

### Feed & Explore

- Each prompt card uses **PromptCard**: creator name links to **Profile** (`/u/{creator.username}`).

### Prompt detail page

- **Creator** — Link to `/u/{creator.username}`.
- **Message** — Button links to `/messages?with={creator.id}` (when not yourself).
- **Comment authors** — Username and avatar link to `/u/{comment.user.username}`.

### Profile page

- **Message** — Button for other users: `/messages?with={user.id}`.
- **Prompts** — Grid of PromptCards (each links to prompt and creator profile).

### Communities

- **Owner, members, join requests, bans** — Usernames link to `/u/{username}`. From there, use **Message** on profile to start a conversation.

### Notifications

- **Message notification** — Click goes to `/messages?with={entity_id}` (entity_id = sender).
- **Other types** — Community → `/c/{slug}`, Prompt → `/prompt/{id}`. Notification row shows **From: {actor_username}** linking to `/u/{actor_username}`.

### Settings

- **View profile** — Links to `/u/{your_username}`.

## How to confirm the right bundle is running

1. Run **frontend**: `npm run dev` (from `frontend/`).
2. Open the URL printed in the terminal (e.g. `http://localhost:5173`).
3. You should see:
   - **Sidebar:** "Explore", "Search", "Context Optimizer", "Communities", **"Messages"**, **"My profile"** (when logged in), "Collections".
   - **Bottom of sidebar:** Avatar + username; clicking goes to your profile.
4. If you only see the theme toggle and not Messages / My profile, you may be viewing an old build (e.g. `npm run preview` with an outdated `dist/`). Stop any old process, run `npm run dev` again, and open the dev server URL.

## Summary

- **Profiles:** Reachable via `/u/:username`; linked from sidebar (My profile + user block), feed cards, prompt detail, comments, communities, notifications, settings.
- **Messages:** Reachable via `/messages`; linked from sidebar, prompt detail (Message button), profile (Message button), and notification click for new messages.
