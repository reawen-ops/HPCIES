from __future__ import annotations

import sqlite3
from pathlib import Path

# 数据库路径配置
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # 到 src 目录
DB_PATH = BASE_DIR / "hpcies.sqlite3"  # SQLite 数据库文件路径


def get_connection() -> sqlite3.Connection:
    """获取 SQLite 数据库连接。

    返回值：
        sqlite3.Connection: 配置为返回字典行的数据库连接对象。
    """
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row  # 设置行工厂为 Row，使查询结果可通过列名访问
    return conn


def init_db() -> None:
    """初始化数据库：创建必要的表结构。

    此函数在应用启动时调用，确保数据库表存在，但不插入任何测试数据。
    """
    conn = get_connection()
    cur = conn.cursor()

    # 用户表：用户名唯一，密码使用 PBKDF2 + salt 哈希存储
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )

    # 会话表：后端生成 token，24h 过期（expires_at）
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )

    # 每用户配置（Welcome 页面填写内容）
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS user_profile (
            user_id INTEGER PRIMARY KEY,
            node_count INTEGER,
            core_per_node INTEGER,
            has_history INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )

    # 为 user_profile 追加字段（如后续扩展）
    try:
        cur.execute("PRAGMA table_info(user_profile)")
        cols = [r[1] for r in cur.fetchall()]
        # 这里预留扩展位，目前无新增列
        _ = cols  # 防止未使用警告
    except Exception:
        pass

    # 创建统计信息表（单行记录）
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS cluster_stats (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            today_saving_percent REAL NOT NULL,
            total_nodes INTEGER NOT NULL,
            running_nodes INTEGER NOT NULL,
            today_tasks INTEGER NOT NULL
        )
        """
    )

    # 创建预测曲线表（24 个小时的数据点）
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS prediction_points (
            hour INTEGER PRIMARY KEY,
            full_load REAL NOT NULL,
            energy_saving REAL NOT NULL
        )
        """
    )

    # 创建节点状态表
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS node_states (
            user_id INTEGER NOT NULL,
            node_id INTEGER NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('running', 'sleeping', 'to_sleep'))
            ,PRIMARY KEY (user_id, node_id)
            ,FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )

    # 创建聊天记录表（用于持久化对话）
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            author TEXT NOT NULL CHECK (author IN ('user', 'ai')),
            text TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )

    # 轻量迁移：兼容旧版本 chat_messages(id, author, text)
    try:
        cur.execute("PRAGMA table_info(chat_messages)")
        cols = [r[1] for r in cur.fetchall()]
        if "user_id" not in cols:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_messages_v2 (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    author TEXT NOT NULL CHECK (author IN ('user', 'ai')),
                    text TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
                """
            )
            cur.execute(
                """
                INSERT INTO chat_messages_v2 (id, user_id, author, text)
                SELECT id, 1 as user_id, author, text FROM chat_messages
                """
            )
            cur.execute("DROP TABLE chat_messages")
            cur.execute("ALTER TABLE chat_messages_v2 RENAME TO chat_messages")
    except Exception:
        pass

    # 创建历史使用数据表，存储从 CSV 导入的时间序列
    # 说明：历史使用数据按 user_id 隔离存储
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS historical_usage (
            user_id INTEGER NOT NULL,
            ts TEXT NOT NULL,
            cpu_load REAL NOT NULL,
            PRIMARY KEY (user_id, ts),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )

    # 轻量迁移：兼容旧版本 historical_usage(ts PRIMARY KEY, cpu_load)
    try:
        cur.execute("PRAGMA table_info(historical_usage)")
        cols = [r[1] for r in cur.fetchall()]
        if "user_id" not in cols:
            # 旧表结构无法直接 ALTER 为复合主键；创建新表并迁移
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS historical_usage_v2 (
                    user_id INTEGER NOT NULL,
                    ts TEXT NOT NULL,
                    cpu_load REAL NOT NULL,
                    PRIMARY KEY (user_id, ts),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
                """
            )
            # 将旧数据临时迁移到 user_id=1（若不存在用户 1，则数据不会被使用）
            cur.execute(
                """
                INSERT OR IGNORE INTO historical_usage_v2 (user_id, ts, cpu_load)
                SELECT 1 as user_id, ts, cpu_load FROM historical_usage
                """
            )
            cur.execute("DROP TABLE historical_usage")
            cur.execute("ALTER TABLE historical_usage_v2 RENAME TO historical_usage")
    except Exception:
        # 迁移失败不阻塞启动（可能是首次创建的新库或并发启动）
        pass

    conn.commit()
    conn.close()
