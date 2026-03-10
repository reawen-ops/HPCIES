import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { FaPaperPlane, FaPaperclip, FaRobot } from "react-icons/fa";
import {
  fetchChatHistory,
  sendChatMessage,
  type ChatHistoryResponse,
  type ChatMessage,
} from "../../api";
import styles from "./ChatContainer.module.scss";

interface ChatContainerProps {
  selectedSessionId?: number | null;
  onChatUpdated?: () => void; // 用于通知外部刷新会话列表等
  contextDate?: string | null; // 当前页面选中的预测日期
}

const ChatContainer = ({
  selectedSessionId,
  onChatUpdated,
  contextDate,
}: ChatContainerProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // 初始加载/切换会话：
    // - 如果 selectedSessionId 为 null，则表示“新对话”，不加载历史，显示欢迎页
    // - 否则拉取指定 session 的历史；未指定则取最新会话
    if (selectedSessionId == null) {
      setMessages([]);
      setCurrentSessionId(null);
      setShowWelcome(true);
      setIsLoadingHistory(false);
      return;
    }

    setIsLoadingHistory(true);
    fetchChatHistory(selectedSessionId)
      .then((data: ChatHistoryResponse) => {
        setCurrentSessionId(data.session_id);
        setMessages(data.messages);
        setShowWelcome(data.messages.length === 0);
      })
      .catch(() => {
        // 后端不可用时保持为空，显示欢迎消息
        setShowWelcome(true);
      })
      .finally(() => {
        setIsLoadingHistory(false);
      });
  }, [selectedSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    setInputValue("");
    setIsLoading(true);
    setShowWelcome(false);

    sendChatMessage(trimmed, currentSessionId || undefined, contextDate ?? undefined)
      .then((data: ChatHistoryResponse) => {
        setCurrentSessionId(data.session_id);
        setMessages(data.messages);
        onChatUpdated?.();
      })
      .catch((error) => {
        console.error("发送消息失败:", error);
        // 显示错误消息
        const errorMessage: ChatMessage = {
          id: Date.now(),
          author: "ai",
          text: "抱歉，发送消息失败，请检查网络连接后重试。",
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  };

  const handleUploadClick = () => {
    alert(
      "文件上传功能演示。在实际系统中，这里将允许用户上传CSV文件进行分析。",
    );
  };

  return (
    <div className={styles["chat-container"]}>
      <div className={styles["chat-header"]}>
        <FaRobot style={{ marginRight: 8 }} />
        HPC能源管家AI助手
      </div>

      <div className={styles["chat-messages"]} aria-busy={isLoadingHistory}>
        {showWelcome && messages.length === 0 && !isLoading && (
          <div className={styles["welcome-message"]}>
            <FaRobot className={styles["welcome-icon"]} />
            <h3>向HPC能源管家AI助手提问</h3>
            <p>我可以帮助您：</p>
            <ul>
              <li>分析集群负载和能耗数据</li>
              <li>提供节能优化建议</li>
              <li>解答HPC调度相关问题</li>
              <li>解释预测结果和策略</li>
            </ul>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              styles.message +
              " " +
              (message.author === "user"
                ? styles["message-user"]
                : styles["message-ai"])
            }
          >
            {message.text}
          </div>
        ))}
        {(isLoading || isLoadingHistory) && (
          <div className={styles.message + " " + styles["message-ai"]}>
            <div className={styles["typing-indicator"]}>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles["chat-input-area"]}>
        <button
          type="button"
          className={styles["upload-btn"]}
          title="上传文件"
          onClick={handleUploadClick}
        >
          <FaPaperclip />
        </button>
        <input
          type="text"
          className={styles["chat-input"]}
          placeholder="输入您的问题或指令..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className={styles["send-btn"]}
          onClick={handleSend}
          disabled={isLoading || !inputValue.trim()}
          aria-label="发送消息"
        >
          <FaPaperPlane />
        </button>
      </div>
    </div>
  );
};

export default ChatContainer;
