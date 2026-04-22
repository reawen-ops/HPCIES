from __future__ import annotations

import sqlite3
from pathlib import Path


def get_db_path() -> Path:
    return Path(__file__).resolve().parent.parent / "src" / "hpcies.sqlite3"


def get_table_names(conn: sqlite3.Connection) -> list[str]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
        """
    )
    return [row[0] for row in cur.fetchall()]


def preview_table(conn: sqlite3.Connection, table_name: str, limit: int = 50) -> None:
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cur.fetchall()]

    cur.execute(f"SELECT * FROM {table_name} LIMIT ?", (limit,))
    rows = cur.fetchall()

    print("=" * 80)
    print(f"表名: {table_name}")
    print(f"字段: {', '.join(columns) if columns else '(无)'}")
    print(f"数据条数(本次预览): {len(rows)}")

    if not rows:
        print("(空表)")
        return

    for idx, row in enumerate(rows, start=1):
        if isinstance(row, sqlite3.Row):
            row_dict = dict(row)
        else:
            row_dict = {columns[i]: row[i] for i in range(len(columns))}
        print(f"[{idx}] {row_dict}")


def main() -> None:
    db_path = get_db_path()
    if not db_path.exists():
        raise SystemExit(f"数据库不存在: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        tables = get_table_names(conn)
        if not tables:
            print("数据库中没有找到业务表。")
            return

        print(f"数据库路径: {db_path}")
        print(f"共发现 {len(tables)} 张表。\n")
        for table_name in tables:
            preview_table(conn, table_name, limit=50)
            print()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
