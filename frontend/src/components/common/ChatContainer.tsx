import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { FaPaperPlane, FaPaperclip, FaRobot } from "react-icons/fa";
import {
  fetchChatHistory,
  sendChatMessage,
  type ChatHistoryResponse,
  type ChatMessage,
} from "../../api";
import styles from "./ChatContainer.module.scss";

const ChatContainer = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchChatHistory()
      .then((data: ChatHistoryResponse) => {
        setMessages(data.messages);
      })
      .catch(() => {
        // 后端不可用时保持为空
      });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    setInputValue("");
    setIsLoading(true);

    sendChatMessage(trimmed)
      .then((data: ChatHistoryResponse) => {
        setMessages(data.messages);
      })
      .catch((error) => {
        console.error("发送消息失败:", error);
        // 显示错误消息
        const errorMessage: ChatMessage = {
          id: Date.now(),
          author: "ai",
          text: "抱歉，发送消息失败，请检查网络连接后重试。",
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
      <div className={styles["chat-messages"]}>
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
        {isLoading && (
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
