import { useEffect, useRef, useState } from "react";
import styles from "./Sidebar.module.scss";
import { FaHistory, FaComments } from "react-icons/fa";
import { FaTrashAlt } from "react-icons/fa";
import {
  fetchChatSessions,
  deleteChatSession,
  type ChatSessionsResponse,
} from "../../../api";

interface SidebarProps {
  onSelectSession?: (sessionId: number | null) => void;
  refreshTrigger?: number;
}

const Sidebar = ({
  onSelectSession,
  refreshTrigger,
}: SidebarProps) => {
  const [sessions, setSessions] = useState<ChatSessionsResponse | null>(null);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const hasInitializedSessionsRef = useRef(false);
  const deletingSessionIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    fetchChatSessions()
      .then((data) => {
        setSessions(data);
        // 仅在首次进入页面时自动选中最新会话，用户之后的操作（包括“新对话”）不再被覆盖
        if (!hasInitializedSessionsRef.current && data.sessions.length > 0) {
          const latestId = data.sessions[0].id;
          setSelectedSession(latestId);
          onSelectSession?.(latestId);
          hasInitializedSessionsRef.current = true;
        }
      })
      .catch(() => {
        setSessions(null);
      });
  }, [refreshTrigger, onSelectSession]);

  const renderSessions = () => {
    if (!sessions || sessions.sessions.length === 0) {
      return (
        <li className={styles["session-list-empty"]}>
          <FaComments />
          暂无对话，发送消息开始新的对话
        </li>
      );
    }

    return sessions.sessions.map((session) => {
      const isSelected = selectedSession === session.id;
      const date = new Date(session.updated_at);
      const timeStr = date.toLocaleString("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      return (
        <li key={session.id} className={styles["tree-item-leaf"]}>
          <div className={styles["session-item"]}>
            <button
              type="button"
              className={`${styles["session-button"]} ${isSelected ? styles["selected"] : ""}`}
              onClick={() => {
                setSelectedSession(session.id);
                onSelectSession?.(session.id);
              }}
              title={session.title}
            >
              <div className={styles["session-title"]}>{session.title}</div>
              <div className={styles["session-meta"]}>
                {timeStr} · {session.message_count}条消息
              </div>
            </button>
            <button
              type="button"
              className={styles["session-delete-button"]}
              aria-label={`删除对话：${session.title}`}
              title="删除对话"
              onClick={async (e) => {
                e.stopPropagation();
                if (deletingSessionIdsRef.current.has(session.id)) return;
                const ok = window.confirm("确定要删除该对话吗？该操作不可恢复。");
                if (!ok) return;

                deletingSessionIdsRef.current.add(session.id);
                // optimistic UI
                setSessions((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    sessions: prev.sessions.filter((s) => s.id !== session.id),
                  };
                });
                if (selectedSession === session.id) {
                  setSelectedSession(null);
                  onSelectSession?.(null);
                }
                try {
                  await deleteChatSession(session.id);
                } catch {
                  // 如果删除失败，回滚为重新拉取
                } finally {
                  deletingSessionIdsRef.current.delete(session.id);
                  fetchChatSessions()
                    .then(setSessions)
                    .catch(() => setSessions(null));
                }
              }}
            >
              <FaTrashAlt />
            </button>
          </div>
        </li>
      );
    });
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles["sidebar-section"]}>
        <div className={styles["sidebar-title"]}>
          <FaHistory />
          对话历史
        </div>
        <div className={styles["chat-actions"]}>
          <button
            type="button"
            className={styles["new-chat-button"]}
            onClick={() => {
              setSelectedSession(null);
              onSelectSession?.(null);
            }}
          >
            <span>新对话</span>
          </button>
        </div>
        <ul className={styles["tree-view"]} id="chat-sessions">
          {renderSessions()}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
