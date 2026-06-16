"""Session Store for Aura engine.

Lightweight SQLite-based persistence for conversation context.
Uses only Python stdlib — no external database required.

Stores:
- Recent messages (role, content, mode, timestamp)
- Mode change history (from_mode, to_mode, reason, timestamp)
- User preferences (key-value pairs)

Thread-safety: all public methods acquire a threading.Lock to prevent
concurrent write errors on the shared SQLite connection.
"""

import os
import sqlite3
import threading
import time
import logging
from typing import Any

logger = logging.getLogger(__name__)


class SessionStore:
    """SQLite-backed session persistence for Aura conversations.

    Args:
        db_path: Path to SQLite database file. If None, uses
                 AURA_DB_PATH env var or ':memory:'.
    """

    def __init__(self, db_path: str | None = None):
        if db_path is None:
            db_path = os.environ.get("AURA_DB_PATH", ":memory:")
        self.db_path = db_path
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._lock = threading.Lock()
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._create_tables()

    def _create_tables(self) -> None:
        """Create tables if they don't exist."""
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL,
                content TEXT,
                mode TEXT DEFAULT 'personal',
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS mode_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_mode TEXT,
                to_mode TEXT NOT NULL,
                reason TEXT,
                created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS preferences (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at REAL NOT NULL DEFAULT (strftime('%s','now'))
            );

            CREATE INDEX IF NOT EXISTS idx_messages_created
                ON messages(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_messages_mode
                ON messages(mode);
            CREATE INDEX IF NOT EXISTS idx_mode_history_created
                ON mode_history(created_at DESC);
        """)
        self._conn.commit()

    def close(self) -> None:
        """Close the database connection."""
        with self._lock:
            if self._conn:
                self._conn.close()

    # --- Messages ---

    def add_message(
        self, role: str, content: str | None, mode: str = "personal"
    ) -> int:
        """Add a message to the store. Returns the row ID."""
        if content is None:
            content = ""
        with self._lock:
            cursor = self._conn.execute(
                "INSERT INTO messages (role, content, mode, created_at) VALUES (?, ?, ?, ?)",
                (role, content, mode, time.time()),
            )
            self._conn.commit()
            return cursor.lastrowid

    def get_recent_messages(self, limit: int = 20) -> list[dict]:
        """Get the most recent messages, newest first."""
        with self._lock:
            rows = self._conn.execute(
                "SELECT role, content, mode, created_at "
                "FROM messages ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]

    def message_count(self) -> int:
        """Return total message count."""
        with self._lock:
            row = self._conn.execute(
                "SELECT COUNT(*) as cnt FROM messages"
            ).fetchone()
            return row["cnt"]

    def clear_messages(self) -> None:
        """Delete all messages."""
        with self._lock:
            self._conn.execute("DELETE FROM messages")
            self._conn.commit()

    # --- Mode History ---

    def record_mode_change(
        self, from_mode: str | None, to_mode: str, reason: str = ""
    ) -> int:
        """Record a mode transition. Returns the row ID."""
        with self._lock:
            cursor = self._conn.execute(
                "INSERT INTO mode_history (from_mode, to_mode, reason, created_at) VALUES (?, ?, ?, ?)",
                (from_mode, to_mode, reason, time.time()),
            )
            self._conn.commit()
            return cursor.lastrowid

    def get_mode_history(self, limit: int = 20) -> list[dict]:
        """Get recent mode transitions, newest first."""
        with self._lock:
            rows = self._conn.execute(
                "SELECT from_mode, to_mode, reason, created_at "
                "FROM mode_history ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]

    def get_last_mode(self) -> str | None:
        """Get the most recent mode, or None if no history."""
        with self._lock:
            row = self._conn.execute(
                "SELECT to_mode FROM mode_history ORDER BY created_at DESC LIMIT 1"
            ).fetchone()
            return row["to_mode"] if row else None

    def clear_mode_history(self) -> None:
        """Delete all mode history."""
        with self._lock:
            self._conn.execute("DELETE FROM mode_history")
            self._conn.commit()

    # --- Preferences ---

    def set_preference(self, key: str, value: str) -> None:
        """Set a user preference (upsert)."""
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO preferences (key, value, updated_at) "
                "VALUES (?, ?, strftime('%s','now'))",
                (key, value),
            )
            self._conn.commit()

    def get_preference(self, key: str) -> str | None:
        """Get a preference value, or None if not set."""
        with self._lock:
            row = self._conn.execute(
                "SELECT value FROM preferences WHERE key = ?", (key,)
            ).fetchone()
            return row["value"] if row else None

    def get_all_preferences(self) -> dict[str, str]:
        """Get all preferences as a dict."""
        with self._lock:
            rows = self._conn.execute(
                "SELECT key, value FROM preferences"
            ).fetchall()
            return {r["key"]: r["value"] for r in rows}

    def delete_preference(self, key: str) -> None:
        """Delete a preference."""
        with self._lock:
            self._conn.execute(
                "DELETE FROM preferences WHERE key = ?", (key,)
            )
            self._conn.commit()
