from __future__ import annotations

import sqlite3
from pathlib import Path


def get_db_path() -> Path:
    return Path(__file__).resolve().parent.parent / "src" / "hpcies.sqlite3"


def has_column(conn: sqlite3.Connection, table: str, column: str) -> bool:
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cur.fetchall())


def migrate_historical_usage(conn: sqlite3.Connection) -> None:
    if not has_column(conn, "historical_usage", "user_id"):
        return

    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS historical_usage_new (
            ts TEXT NOT NULL PRIMARY KEY,
            cpu_load REAL NOT NULL
        )
        """
    )
    cur.execute(
        """
        INSERT OR REPLACE INTO historical_usage_new (ts, cpu_load)
        SELECT ts, cpu_load
        FROM historical_usage
        ORDER BY ts
        """
    )
    cur.execute("DROP TABLE historical_usage")
    cur.execute("ALTER TABLE historical_usage_new RENAME TO historical_usage")


def migrate_node_states(conn: sqlite3.Connection) -> None:
    if not has_column(conn, "node_states", "user_id"):
        return

    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS node_states_new (
            node_id INTEGER NOT NULL PRIMARY KEY,
            status TEXT NOT NULL CHECK (status IN ('running', 'sleeping', 'to_sleep'))
        )
        """
    )
    cur.execute(
        """
        INSERT OR REPLACE INTO node_states_new (node_id, status)
        SELECT node_id, status
        FROM node_states
        ORDER BY node_id
        """
    )
    cur.execute("DROP TABLE node_states")
    cur.execute("ALTER TABLE node_states_new RENAME TO node_states")


def main() -> None:
    db_path = get_db_path()
    if not db_path.exists():
        raise SystemExit(f"数据库不存在: {db_path}")

    conn = sqlite3.connect(db_path)
    try:
        migrate_historical_usage(conn)
        migrate_node_states(conn)
        conn.commit()
        print("迁移完成：historical_usage、node_states 已移除 user_id 字段。")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
