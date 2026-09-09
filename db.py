"""SQLite storage for equipment observations. Plain functions over sqlite3.Connection, no ORM."""
import csv
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

_TAXONOMY_CSV = Path(__file__).parent / "taxonomy.csv"

_OBSERVATION_FIELDS = [
    "customer", "city", "country", "modality", "brand", "model",
    "quantity", "age_years", "status", "confidence", "source_text",
]


def init_db(path: str = "observations.db") -> sqlite3.Connection:
    is_new = not Path(path).exists()
    # check_same_thread=False: Streamlit can rerun the script on a different
    # thread than the one that opened this cached connection.
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row

    conn.execute("""
        CREATE TABLE IF NOT EXISTS observations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer TEXT,
            city TEXT,
            country TEXT,
            modality TEXT,
            brand TEXT,
            model TEXT,
            quantity INTEGER,
            age_years REAL,
            status TEXT,
            confidence REAL,
            corroboration_count INTEGER DEFAULT 1,
            source_text TEXT,
            created_at TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS taxonomy (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT,
            value TEXT
        )
    """)
    conn.commit()

    if is_new:
        _seed_taxonomy(conn)

    return conn


def _seed_taxonomy(conn: sqlite3.Connection) -> None:
    with open(_TAXONOMY_CSV, newline="", encoding="utf-8") as f:
        rows = [(r["category"], r["value"]) for r in csv.DictReader(f)]
    conn.executemany("INSERT INTO taxonomy (category, value) VALUES (?, ?)", rows)
    conn.commit()


def insert_observation(conn: sqlite3.Connection, fields: dict) -> int:
    values = [fields.get(k) for k in _OBSERVATION_FIELDS]
    cur = conn.execute(
        f"""INSERT INTO observations
            ({", ".join(_OBSERVATION_FIELDS)}, corroboration_count, created_at)
            VALUES ({", ".join(["?"] * len(_OBSERVATION_FIELDS))}, 1, ?)""",
        [*values, datetime.now(timezone.utc).isoformat()],
    )
    conn.commit()
    return cur.lastrowid


def update_corroboration(conn: sqlite3.Connection, obs_id: int, new_confidence: float, new_status: str) -> None:
    conn.execute(
        """UPDATE observations
           SET corroboration_count = corroboration_count + 1,
               confidence = ?,
               status = ?
           WHERE id = ?""",
        (new_confidence, new_status, obs_id),
    )
    conn.commit()


def get_all_observations(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("SELECT * FROM observations ORDER BY id DESC").fetchall()
    return [dict(r) for r in rows]


def get_observations_by_customer(conn: sqlite3.Connection, customer: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM observations WHERE customer = ? COLLATE NOCASE ORDER BY id DESC",
        (customer,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_taxonomy(conn: sqlite3.Connection, category: str) -> list[str]:
    rows = conn.execute(
        "SELECT value FROM taxonomy WHERE category = ? ORDER BY value", (category,)
    ).fetchall()
    return [r["value"] for r in rows]
