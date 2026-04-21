from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd


def get_db_path() -> Path:
    return Path(__file__).resolve().parent.parent / "src" / "hpcies.sqlite3"


def parse_rows(csv_path: Path) -> list[tuple[str, float]]:
    df = pd.read_csv(csv_path)
    rows: list[tuple[str, float]] = []

    if {"日期", "小时", "CPU核时使用量"}.issubset(df.columns):
        df = df[df["日期"] != "日期"].copy()
        df["小时"] = df["小时"].astype(str).str.zfill(2)
        df["完整时间"] = pd.to_datetime(df["日期"] + " " + df["小时"] + ":00:00")
        df["CPU核时使用量"] = df["CPU核时使用量"].astype(float)
        for _, row in df.iterrows():
            ts = row["完整时间"].strftime("%Y-%m-%d %H:%M:%S")
            rows.append((ts, float(row["CPU核时使用量"])))
    else:
        for _, row in df.iterrows():
            ts = str(row.iloc[0])
            load = float(row.iloc[1])
            rows.append((ts, load))

    return rows


def main() -> None:
    db_path = get_db_path()
    if not db_path.exists():
        raise SystemExit(f"数据库不存在: {db_path}")

    raw = input("请输入本地 CSV 文件路径: ").strip().strip('"')
    csv_path = Path(raw)
    if not csv_path.exists():
        raise SystemExit(f"CSV 文件不存在: {csv_path}")

    rows = parse_rows(csv_path)
    if not rows:
        raise SystemExit("CSV 中没有可导入数据。")

    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.executemany(
            "INSERT OR REPLACE INTO historical_usage (ts, cpu_load) VALUES (?, ?)",
            rows,
        )
        conn.commit()
        print(f"导入完成，共写入 {len(rows)} 条记录。")
        print(f"时间范围: {min(ts for ts, _ in rows)} ~ {max(ts for ts, _ in rows)}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
