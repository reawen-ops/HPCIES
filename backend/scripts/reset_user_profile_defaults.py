from __future__ import annotations

import sqlite3
from pathlib import Path


def get_db_path() -> Path:
    return Path(__file__).resolve().parent.parent / "src" / "hpcies.sqlite3"


def resolve_node_column(conn: sqlite3.Connection) -> str:
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(user_profile)")
    columns = [row[1] for row in cur.fetchall()]
    if "node_count" in columns:
        return "node_count"
    if "node_code" in columns:
        return "node_code"
    raise RuntimeError("user_profile 表中未找到 node_count 或 node_code 字段")


def main() -> None:
    db_path = get_db_path()
    if not db_path.exists():
        raise SystemExit(f"数据库不存在: {db_path}")

    conn = sqlite3.connect(db_path)
    try:
        node_column = resolve_node_column(conn)
        cur = conn.cursor()
        cur.execute(
            f"""
            UPDATE user_profile
            SET {node_column} = 38,
                core_per_node = 64,
                has_history = 1
            """
        )
        conn.commit()
        print(f"更新完成：{cur.rowcount} 条 user_profile 记录已重置为默认值。")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
