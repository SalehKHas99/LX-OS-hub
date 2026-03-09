# LX-OS — Phase 2 Integration Guide
## Database Schema + Alembic Setup (Complete Walkthrough)

This guide assumes:
- You have a Neon account with an existing database you want to wipe
- You are using a Mac or Linux terminal (Windows users: use WSL or Git Bash)
- You have Python 3.11+ installed
- You are using Cursor AI as your IDE

---

## PART 1 — Wipe Your Existing Neon Database

Do this before touching any code.

1. Go to [https://console.neon.tech](https://console.neon.tech)
2. Open your project
3. Click **SQL Editor** in the left sidebar
4. Paste and run this exactly:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
```

5. You should see: `DROP SCHEMA`, `CREATE SCHEMA`, `GRANT`
6. Your database is now completely empty ✓

---

## PART 2 — Get Your Neon Connection String

1. In the Neon dashboard, click **Connection Details** (left sidebar)
2. Copy the **Connection string** — it looks like:
   ```
   postgresql://alex:password@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. **You must change the prefix** from `postgresql://` to `postgresql+asyncpg://`

   Final format:
   ```
   postgresql+asyncpg://alex:password@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

   Keep this — you'll paste it into your `.env` file shortly.

---

## PART 3 — Set Up Your Python Environment

Open your terminal and navigate to the `backend` folder:

```bash
cd lxos/backend
```

### Step 1: Create a virtual environment

```bash
python3 -m venv venv
```

### Step 2: Activate it

**Mac/Linux:**
```bash
source venv/bin/activate
```

**Windows (Git Bash):**
```bash
source venv/Scripts/activate
```

You should see `(venv)` appear at the start of your terminal prompt.

### Step 3: Install all dependencies

```bash
pip install -r requirements.txt
```

This installs FastAPI, SQLAlchemy, asyncpg, Alembic, and everything else.
It takes about 60–90 seconds the first time.

---

## PART 4 — Create Your .env File

### Step 1: Copy the example file

```bash
cp .env.example .env
```

### Step 2: Open `.env` in Cursor and fill in your values

The only field you **must** fill in right now is `DATABASE_URL`.

```
DATABASE_URL=postgresql+asyncpg://alex:password@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require
```

For `SECRET_KEY`, generate a secure one by running:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Paste the output into `.env`:
```
SECRET_KEY=the-output-you-just-generated
```

Leave `ANTHROPIC_API_KEY` and `SUPABASE_*` blank for now — they are not needed until Phase 5 and 6.

---

## PART 5 — Verify Models Import Correctly

Before running any migration, confirm Python can see all your models:

```bash
python -c "from app.models import Base; print('OK — tables:', list(Base.metadata.tables.keys()))"
```

Expected output (order may vary):
```
OK — tables: ['users', 'communities', 'prompts', 'prompt_context_blocks',
'prompt_versions', 'prompt_images', 'tags', 'prompt_tags', 'comments',
'collections', 'collection_items', 'reports', 'site_settings',
'announcements', 'featured_items', 'user_bans', 'audit_logs', 'admin_notes']
```

If you see an ImportError — check that your `(venv)` is activated and you ran `pip install -r requirements.txt`.

---

## PART 6 — Run Alembic for the First Time

### Step 1: Generate the initial migration

This command reads your SQLAlchemy models and auto-generates the SQL migration:

```bash
alembic revision --autogenerate -m "initial_schema"
```

You will see output like:
```
INFO  [alembic.runtime.migration] Context impl PostgreSQLImpl.
INFO  [alembic.autogenerate.compare] Detected added table 'users'
INFO  [alembic.autogenerate.compare] Detected added table 'communities'
... (one line per table)
  Generating /lxos/backend/alembic/versions/20240315_1042_initial_schema.py ... done
```

A new file appears in `alembic/versions/`. This is your migration file.

### Step 2: Review the migration (recommended)

Open the generated file in Cursor. You should see `op.create_table(...)` calls for every model. Skim it to confirm everything looks right — all 18 tables should be present.

### Step 3: Apply the migration to Neon

```bash
alembic upgrade head
```

Expected output:
```
INFO  [alembic.runtime.migration] Running upgrade  -> abc123, initial_schema
```

This creates every table, index, and enum in your Neon database. ✓

### Step 4: Verify in Neon

1. Go to Neon dashboard → SQL Editor
2. Run:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   ORDER BY table_name;
   ```
3. You should see all 18 tables listed.

---

## PART 7 — Run the Post-Migration SQL

These two files must be run manually in the Neon SQL Editor.
Alembic does not manage them — they are Postgres-native operations.

### Step 1: Full-text search trigger

1. Open `setup_search_trigger.sql` in Cursor
2. Copy the entire contents
3. Paste into Neon SQL Editor and run

Expected output: `CREATE FUNCTION`, `CREATE TRIGGER`, `UPDATE`

### Step 2: Seed default site settings

1. Open `seed_site_settings.sql` in Cursor
2. Copy the entire contents
3. Paste into Neon SQL Editor and run

Expected output: `INSERT 0 11`

Verify:
```sql
SELECT key, value, "group" FROM site_settings ORDER BY "group", key;
```

You should see 11 rows with keys like `site_name`, `primary_color`, `maintenance_mode`, etc.

---

## PART 8 — Understanding Alembic for Ongoing Use

Now that it's set up, here are the only commands you'll use regularly:

### When you change a model

After editing any file in `app/models/`:

```bash
# Generate a new migration file
alembic revision --autogenerate -m "describe what changed"

# Apply it
alembic upgrade head
```

### Check what version your database is on

```bash
alembic current
```

### See migration history

```bash
alembic history
```

### Roll back one migration (undo the last change)

```bash
alembic downgrade -1
```

### Roll back to the very beginning (wipes all tables)

```bash
alembic downgrade base
```

---

## PART 9 — Common Problems and Fixes

### "ModuleNotFoundError: No module named 'app'"

Your virtual environment is not activated, or you are running the command from the wrong directory.

Fix:
```bash
cd lxos/backend          # make sure you're here
source venv/bin/activate # activate venv
```

### "asyncpg.exceptions.InvalidPasswordError" or connection refused

Your `DATABASE_URL` in `.env` has a typo, wrong password, or is still using `postgresql://` instead of `postgresql+asyncpg://`.

Fix: Open `.env`, double-check the URL. Copy it fresh from Neon dashboard.

### Alembic says "Target database is not up to date"

Someone (or you) applied a migration file that was deleted. Fix:
```bash
alembic stamp head   # tells Alembic "treat current DB state as latest"
```

### "Can't locate revision" error

The migration file in `alembic/versions/` was deleted but the database still has its revision ID recorded.

Fix: Re-wipe Neon (Part 1 of this guide) and start fresh with a new `alembic revision --autogenerate`.

### Enum already exists error on re-migration

If you drop and recreate the schema and Alembic errors on enum types, add this to the top of your `upgrade()` in the migration file:

```python
op.execute("DROP TYPE IF EXISTS userrole CASCADE")
op.execute("DROP TYPE IF EXISTS modelfamily CASCADE")
# ... etc for each enum
```

This is only needed if you manually wiped the schema without going through `alembic downgrade base`.

---

## PART 10 — Final Checklist

- [ ] Neon schema wiped and fresh
- [ ] `.env` created with correct `DATABASE_URL` (asyncpg format) and `SECRET_KEY`
- [ ] `pip install -r requirements.txt` completed without errors
- [ ] `python -c "from app.models import Base; print(Base.metadata.tables.keys())"` shows 18 tables
- [ ] `alembic revision --autogenerate -m "initial_schema"` created a file in `alembic/versions/`
- [ ] `alembic upgrade head` ran without errors
- [ ] Neon SQL Editor confirms 18 tables exist
- [ ] `setup_search_trigger.sql` run in Neon SQL Editor
- [ ] `seed_site_settings.sql` run in Neon SQL Editor — 11 rows visible in `site_settings`

Phase 2 is complete. Proceed to Phase 3: FastAPI Foundation.
