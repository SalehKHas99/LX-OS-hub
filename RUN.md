# How to Run LX-OS

## Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.11+
- **PostgreSQL** (e.g. [Neon](https://neon.tech) free tier) with asyncpg-compatible URL

---

## 1. Backend

### 1.1 Environment

From the project root:

```bash
cd backend
```

Copy the example env and edit with your values:

```bash
copy .env.example .env
```

Edit `backend/.env` and set at least:

- **`DATABASE_URL`** — Use **`postgresql+asyncpg://...`** (not `postgresql://`).  
  Example: `postgresql+asyncpg://user:password@host.neon.tech/dbname?sslmode=require`
- **`SECRET_KEY`** — Random string for JWT. Generate with:  
  `python -c "import secrets; print(secrets.token_hex(32))"`

Optional: `ANTHROPIC_API_KEY` (Context Lab), `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` (uploads).

### 1.2 Virtual environment and dependencies

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

On macOS/Linux use `source venv/bin/activate` instead of `venv\Scripts\activate`.

### 1.3 Database migrations

```bash
python -m alembic upgrade head
```

### 1.4 Start the API server

```bash
uvicorn app.main:app --reload
```

- API: **http://127.0.0.1:8000**
- Docs: **http://127.0.0.1:8000/docs** (when `ENVIRONMENT` is not `production`)

If the process exits with code 1, check:

- `.env` exists in `backend/` and contains valid `DATABASE_URL` and `SECRET_KEY`
- Database is reachable and migrations have been run

---

## 2. Frontend

### 2.1 Environment

```bash
cd frontend
copy .env.example .env
```

Ensure `frontend/.env` has:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

(Only change if your backend runs on another host/port.)

### 2.2 Dependencies and dev server

```bash
cd frontend
npm install
npm run dev
```

- App: **http://localhost:5173**

---

## 3. Run both (two terminals)

**Terminal 1 – Backend**

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload
```

**Terminal 2 – Frontend**

```bash
cd frontend
npm run dev
```

Then open **http://localhost:5173** in your browser. The frontend will call the API at `http://127.0.0.1:8000` (or whatever you set in `VITE_API_BASE_URL`).
