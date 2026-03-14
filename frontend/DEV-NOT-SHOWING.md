# Why "recent changes" (profiles, messages) don’t show

## Root cause

**You are almost certainly loading the old built app instead of the live dev app.**

| How you run        | What gets served        | Has profiles/messages? |
|--------------------|-------------------------|-------------------------|
| `npm run dev`      | Source from `src/`      | **Yes** (latest code)   |
| `npm run preview`  | Built files from `dist/`| **No** (last build only)|
| Opening `dist/index.html` (e.g. file:// or another server) | Same as preview | **No** |

- **Dev** (`npm run dev`): Vite serves `index.html` which loads `/src/main.tsx` and compiles on the fly. You see the latest code, including profiles and messages.
- **Preview / dist**: Serves `dist/index.html`, which loads a single JS bundle (e.g. `/assets/index-xxx.js`) produced at **last `npm run build`**. No live source, so no new changes.

So if you run **preview** or open **dist**, you will not see recent changes until you run **build** again. For day‑to‑day work you must use **dev**.

---

## How to confirm you’re on the right bundle

1. **Green “DEV” badge**  
   When the app is from `npm run dev`, a small green **DEV** pill appears in the top bar (left side). If you don’t see it, you’re on the build/preview bundle.

2. **Browser console**  
   With dev, you should see:  
   `[LX-OS] Dev mode — source bundle. Profiles & Messages are active.`  
   If that log is missing, the page is not from the dev server.

3. **URL**  
   Use exactly the URL printed when you start the dev server (e.g. **http://localhost:5173**). Don’t use a different port or a `file://` path to `dist/`.

---

## What to do

1. **Stop any running frontend** (Ctrl+C in the terminal where it’s running).
2. **From the project frontend folder**, run:
   ```bash
   cd frontend
   npm run dev
   ```
3. **Open the URL shown** (e.g. http://localhost:5173) in the browser.
4. **Hard refresh** (Ctrl+Shift+R or Ctrl+F5).
5. **Check**: You should see the green **DEV** badge and the console log above. Then use **Messages** in the sidebar and **creator names** (e.g. on prompt cards) to open profiles and messages.

Do **not** use `npm run preview` when you want to see the latest code. Use it only to test the production build.
