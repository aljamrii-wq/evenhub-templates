"""Tests for engine/session_store.py — Session Store."""

import os
import json
import tempfile
import pytest
from session_store import SessionStore


@pytest.fixture
def store():
    """Create a SessionStore backed by a temp file."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    s = SessionStore(path)
    yield s
    s.close()
    if os.path.exists(path):
        os.unlink(path)


class TestSessionStoreInitialization:
    def test_creates_tables(self, store):
        """Tables should be created on init."""
        tables = store._conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        table_names = [t[0] for t in tables]
        assert "messages" in table_names
        assert "mode_history" in table_names
        assert "preferences" in table_names


class TestMessagesTable:
    def test_add_and_get_messages(self, store):
        store.add_message("user", "Hello world", "personal")
        store.add_message("assistant", "Hi there!", "personal")
        msgs = store.get_recent_messages(limit=10)
        assert len(msgs) == 2
        # Most recent first (DESC order)
        assert msgs[0]["role"] == "assistant"
        assert msgs[0]["content"] == "Hi there!"
        assert msgs[1]["role"] == "user"

    def test_get_recent_messages_limit(self, store):
        for i in range(10):
            store.add_message("user", f"Message {i}", "personal")
        msgs = store.get_recent_messages(limit=5)
        assert len(msgs) == 5

    def test_messages_ordered_by_timestamp_desc(self, store):
        store.add_message("user", "First", "personal")
        store.add_message("user", "Second", "personal")
        store.add_message("user", "Third", "personal")
        msgs = store.get_recent_messages(limit=10)
        assert msgs[0]["content"] == "Third"
        assert msgs[2]["content"] == "First"

    def test_clear_messages(self, store):
        store.add_message("user", "Test", "personal")
        store.clear_messages()
        msgs = store.get_recent_messages(limit=10)
        assert len(msgs) == 0

    def test_message_count(self, store):
        assert store.message_count() == 0
        store.add_message("user", "A", "personal")
        store.add_message("user", "B", "personal")
        assert store.message_count() == 2


class TestModeHistoryTable:
    def test_record_and_get_mode_history(self, store):
        store.record_mode_change("personal", "flydubai", "time-based")
        store.record_mode_change("flydubai", "aljamri", "keywords")
        history = store.get_mode_history(limit=10)
        assert len(history) == 2
        assert history[1]["from_mode"] == "personal"
        assert history[1]["to_mode"] == "flydubai"
        assert history[0]["from_mode"] == "flydubai"

    def test_mode_history_limit(self, store):
        for i in range(5):
            store.record_mode_change("personal", "flydubai", f"reason {i}")
        history = store.get_mode_history(limit=3)
        assert len(history) == 3

    def test_get_last_mode(self, store):
        store.record_mode_change("personal", "flydubai", "time")
        store.record_mode_change("flydubai", "aljamri", "keywords")
        assert store.get_last_mode() == "aljamri"

    def test_get_last_mode_empty(self, store):
        assert store.get_last_mode() is None

    def test_clear_mode_history(self, store):
        store.record_mode_change("a", "b", "test")
        store.clear_mode_history()
        assert len(store.get_mode_history(limit=10)) == 0


class TestPreferencesTable:
    def test_set_and_get_preference(self, store):
        store.set_preference("theme", "dark")
        assert store.get_preference("theme") == "dark"

    def test_get_missing_preference(self, store):
        assert store.get_preference("nonexistent") is None

    def test_get_all_preferences(self, store):
        store.set_preference("theme", "dark")
        store.set_preference("font_size", "24")
        prefs = store.get_all_preferences()
        assert prefs["theme"] == "dark"
        assert prefs["font_size"] == "24"

    def test_update_preference(self, store):
        store.set_preference("theme", "dark")
        store.set_preference("theme", "light")
        assert store.get_preference("theme") == "light"

    def test_delete_preference(self, store):
        store.set_preference("theme", "dark")
        store.delete_preference("theme")
        assert store.get_preference("theme") is None

    def test_delete_nonexistent_preference(self, store):
        store.delete_preference("nonexistent")  # should not raise

    def test_get_all_preferences_empty(self, store):
        assert store.get_all_preferences() == {}


class TestSessionStoreEdgeCases:
    def test_performance_many_messages(self, store):
        for i in range(100):
            store.add_message("user", f"Message {i}", "personal")
        assert store.message_count() == 100
        msgs = store.get_recent_messages(limit=50)
        assert len(msgs) == 50

    def test_unicode_messages(self, store):
        store.add_message("user", "مرحبا بالعالم", "personal")
        msgs = store.get_recent_messages(limit=1)
        assert msgs[0]["content"] == "مرحبا بالعالم"

    def test_emoji_in_messages(self, store):
        store.add_message("user", "Hello 👋🌍", "personal")
        msgs = store.get_recent_messages(limit=1)
        assert "👋" in msgs[0]["content"]

    def test_null_content_handled(self, store):
        store.add_message("system", None, "personal")
        msgs = store.get_recent_messages(limit=1)
        assert msgs[0]["content"] == "" or msgs[0]["content"] is None

    def test_concurrent_writes_no_errors(self, store):
        """Concurrent writes should not cause InterfaceError or data loss."""
        import threading
        errors = []
        results = []

        def writer(start: int, count: int):
            try:
                for i in range(start, start + count):
                    rid = store.add_message("user", f"Concurrent {i}", "personal")
                    results.append(rid)
            except Exception as exc:
                errors.append(exc)

        threads = []
        total_per_thread = 50
        thread_count = 4
        for t in range(thread_count):
            th = threading.Thread(target=writer, args=(t * total_per_thread, total_per_thread))
            threads.append(th)
            th.start()

        for th in threads:
            th.join()

        # No errors during concurrent writes
        assert len(errors) == 0, f"Got {len(errors)} errors: {errors}"
        # All writes succeeded
        assert store.message_count() == thread_count * total_per_thread
        # All row IDs are positive integers
        assert all(isinstance(r, int) and r > 0 for r in results)

