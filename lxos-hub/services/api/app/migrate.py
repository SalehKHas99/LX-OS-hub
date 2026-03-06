from pathlib import Path
from app.db import get_conn

def main():
    migration_dir = Path(__file__).parent / "migrations"
    files = sorted(p for p in migration_dir.glob("*.sql"))
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "create table if not exists schema_migrations "
                "(name text primary key, applied_at timestamptz default now())"
            )
            for path in files:
                cur.execute("select 1 from schema_migrations where name=%s", (path.name,))
                if cur.fetchone():
                    print(f"  skip  {path.name}")
                    continue
                print(f"  apply {path.name}")
                cur.execute(path.read_text())
                cur.execute("insert into schema_migrations(name) values (%s)", (path.name,))
        conn.commit()
    print("Migrations complete.")

if __name__ == "__main__":
    main()
