import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { FaPaperPlane, FaPaperclip, FaRobot } from "react-icons/fa";
import styles from "./ChatContainer.module.scss";

type MessageAuthor = "user" | "ai";

interface Message {
  id: number;
  author: MessageAuthor;
  text: string;
}

const initialAiMessage: Message = {
  id: 1,
  author: "ai",
  text: "您好！我是HPC能源管家AI助手。请上传您的HPC使用数据，我将为您分析并生成节能策略。",
};

const aiResponses = [
  "我已收到您的请求。根据当前数据分析，建议在下午2点到4点之间将20%的节点设置为休眠状态。",
  "正在为您重新计算节能策略...计算完成！新的策略预计可节省28%的能源消耗。",
  "这是您请求的今日预测曲线（绿色为全开模式，蓝色为节能模式）。",
  "已根据您的指令调整策略。新的节点状态矩阵已更新。",
  "根据历史数据趋势分析，明天上午9点至11点将出现计算高峰，建议提前唤醒15%的节点。",
];

const ChatContainer = () => {
  const [messages, setMessages] = useState<Message[]>([initialAiMessage]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const nextId = useMemo(
    () => messages.reduce((max, msg) => Math.max(max, msg.id), 1) + 1,
    [messages],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const userMessage: Message = {
      id: nextId,
      author: "user",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    // 模拟 AI 回复
    const replyId = nextId + 1;
    const replyText =
      aiResponses[Math.floor(Math.random() * aiResponses.length)];

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: replyId,
          author: "ai",
          text: replyText,
        },
      ]);
    }, 1000);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  };

  const handleUploadClick = () => {
    // eslint-disable-next-line no-alert
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
        >
          <FaPaperPlane />
        </button>
      </div>
    </div>
  );
};

export default ChatContainer;


