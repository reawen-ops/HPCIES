import { useEffect, useRef, useState } from "react";
import styles from "./Sidebar.module.scss";
import { BsDatabaseFill } from "react-icons/bs";
import { FaFolder, FaHistory, FaComments } from "react-icons/fa";
import {
  fetchHistoryTree,
  fetchChatSessions,
  type HistoryTreeResponse,
  type ChatSessionsResponse,
} from "../../../api";

interface OpenState {
  [key: string]: boolean;
}

interface SidebarProps {
  onSelectDate?: (date: string) => void;
  onSelectSession?: (sessionId: number | null) => void;
  refreshTrigger?: number;
}

const Sidebar = ({
  onSelectDate,
  onSelectSession,
  refreshTrigger,
}: SidebarProps) => {
  const [tree, setTree] = useState<HistoryTreeResponse | null>(null);
  const [sessions, setSessions] = useState<ChatSessionsResponse | null>(null);
  const [open, setOpen] = useState<OpenState>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const hasInitializedSessionsRef = useRef(false);

  useEffect(() => {
    fetchHistoryTree()
      .then(setTree)
      .catch(() => {
        setTree(null);
      });

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

  const toggleKey = (key: string) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderTree = () => {
    if (!tree || tree.years.length === 0) {
      return (
        <li className={styles["tree-item"]}>
          <FaFolder />
          暂无数据
        </li>
      );
    }

    return tree.years.map((year) => {
      const yearKey = `y-${year.year}`;
      const yearOpen = open[yearKey] ?? false;
      return (
        <li key={yearKey} className={styles["tree-item"]}>
          <button
            type="button"
            onClick={() => toggleKey(yearKey)}
            className={styles["tree-toggle"]}
          >
            <FaFolder />
            <span>{year.year}年</span>
          </button>
          {yearOpen && (
            <ul className={styles["tree-children"]}>
              {year.months.map((month) => {
                const monthKey = `${yearKey}-m-${month.month}`;
                const monthOpen = open[monthKey] ?? false;
                return (
                  <li key={monthKey} className={styles["tree-item"]}>
                    <button
                      type="button"
                      onClick={() => toggleKey(monthKey)}
                      className={styles["tree-toggle"]}
                    >
                      <FaFolder />
                      <span>{month.month}月</span>
                    </button>
                    {monthOpen && (
                      <ul className={styles["tree-children"]}>
                        {month.days.map((day) => {
                          const dayLabel = day.date.split("-")[2];
                          const isSelected = selectedDate === day.date;
                          return (
                            <li
                              key={day.date}
                              className={styles["tree-item-leaf"]}
                            >
                              <button
                                type="button"
                                className={`${styles["tree-leaf-button"]} ${isSelected ? styles["selected"] : ""}`}
                                onClick={() => {
                                  setSelectedDate(day.date);
                                  onSelectDate?.(day.date);
                                }}
                              >
                                {dayLabel}日
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      );
    });
  };

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
        </li>
      );
    });
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles["sidebar-section"]}>
        <div className={styles["sidebar-title"]}>
          <BsDatabaseFill />
          数据详情
        </div>
        <ul className={styles["tree-view"]} id="data-tree">
          {renderTree()}
        </ul>
      </div>

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
