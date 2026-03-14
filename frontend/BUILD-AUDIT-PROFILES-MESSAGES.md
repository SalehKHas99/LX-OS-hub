# Build audit: Profiles, Messages, Notifications

This doc summarizes how profiles, messages, and notifications are wired and what was fixed so **build and dev both reflect the same code**.

## 1. What’s in the bundle

All of these are **statically imported** in `App.tsx`, so they are always in the bundle (dev and production):

- `ProfilePage` → route `/u/:username`
- `MessagesPage` → route `/messages`
- `AppShell` (sidebar with Messages nav + unread badge, notifications dropdown)

No dynamic imports or env gates remove these pages from the build.

## 2. Backend routes (must be running)

| Feature        | Route prefix        | Example                          |
|----------------|---------------------|----------------------------------|
| Profiles       | `/api/v1/users`     | `GET /api/v1/users/{username}`   |
| Messages       | `/api/v1/messages`  | `GET /api/v1/messages/unread-count`, `/conversations`, `/with/:id` |
| Notifications  | `/api/v1/notifications` | `GET /api/v1/notifications`  |

In `backend/app/main.py`, these are included:

- `profiles.router` with prefix `/api/v1` (router itself has prefix `/users`)
- `messages.router` with prefix `/api/v1` (router has prefix `/messages`)
- `notifications.router` with prefix `/api/v1`

So the backend is correctly wired.

## 3. Frontend API client

- **baseURL**: `'/api/v1'` by default (relative). In **build**, if you set `VITE_API_BASE_URL` (e.g. `https://api.example.com`), the client uses `{VITE_API_BASE_URL}/api/v1` so production can hit a different API origin.
- **Auth refresh**: The refresh interceptor uses the same `api` instance (and thus the same baseURL), so it works with a custom API origin.

## 4. Bug fixed: Profile page crash when `prompts` was undefined

**Cause:** While the profile user query had finished, the prompts query could still be loading. Then:

- `prompts?.items.length` → when `prompts` is `undefined`, `prompts?.items` is `undefined`, and `undefined.length` throws.
- `prompts?.items.map(...)` → same: `undefined.map` throws.

So the profile page could crash and show a blank or error screen instead of the new UI.

**Fix:** Use safe fallbacks so we never read `.length` or `.map` on undefined:

- Empty list check: `(prompts?.items ?? []).length === 0`
- Render list: `(prompts?.items ?? []).map(p => <PromptCard ... />)`

After this, the profile page renders even while prompts are still loading.

## 5. What to do so “the build” shows profiles and messages

1. **Backend running**  
   Start the API (e.g. `uvicorn app.main:app --reload`) so `/api/v1/users/*` and `/api/v1/messages/*` exist.

2. **Dev**  
   - Run `npm run dev` and open the printed URL (e.g. `http://localhost:5173`).  
   - You should see the “DEV” badge and the Messages item in the sidebar.  
   - Visit `/u/someusername` and `/messages` to confirm.

3. **Production build**  
   - Run `npm run build`.  
   - Serve the `dist/` folder (e.g. `npm run preview` or your host).  
   - If the API is on another origin, set `VITE_API_BASE_URL` before building (e.g. `VITE_API_BASE_URL=https://api.example.com npm run build`).  
   - Ensure your server or reverse proxy serves the SPA for all app routes and proxies `/api` to the backend (or that the app uses `VITE_API_BASE_URL` and CORS is set correctly).

4. **Cache**  
   If you still see old behavior after a new build:
   - Do a hard refresh (Ctrl+Shift+R / Cmd+Shift+R) or open in an incognito window.
   - Confirm you’re opening the URL that serves the new build (e.g. `http://localhost:5173` in dev, or the correct origin in production), not an old bookmark or cached HTML.

## 6. Quick checklist

- [ ] `backend/app/main.py` includes `profiles`, `messages`, `notifications` routers.
- [ ] `frontend/src/App.tsx` has routes for `/u/:username` (ProfilePage) and `/messages` (MessagesPage).
- [ ] `frontend/src/components/layout/AppShell.tsx` has “Messages” in `NAV` and uses `messagesApi.getUnreadCount()` for the badge.
- [ ] `frontend/src/api/client.ts` uses `baseURL` (with optional `VITE_API_BASE_URL` in build).
- [ ] `frontend/src/pages/ProfilePage.tsx` uses `(prompts?.items ?? [])` so it never crashes when prompts are still loading.

After the ProfilePage fix and the client baseURL/refresh behavior, the same code paths run in both dev and production build; any remaining “changes not reflected” are usually due to backend not running, wrong URL, or cache.
