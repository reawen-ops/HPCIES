import {
  useEffect,
  useRef,
  useState,
  useReducer,
  type KeyboardEvent,
} from "react";
import { FaPaperPlane, FaRobot } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  fetchChatHistory,
  sendChatMessage,
  type ChatHistoryResponse,
  type ChatMessage,
} from "../../api";
import styles from "./ChatContainer.module.scss";

interface ChatContainerProps {
  selectedSessionId?: number | null;
  onChatUpdated?: () => void;
  contextDate?: string | null;
}

// 定义状态类型
interface ChatState {
  messages: ChatMessage[];
  currentSessionId: number | null;
  showWelcome: boolean;
  isLoadingHistory: boolean;
}

// 定义 action 类型
type ChatAction =
  | { type: "RESET" }
  | {
      type: "SET_HISTORY";
      payload: { sessionId: number; messages: ChatMessage[] };
    }
  | { type: "SET_MESSAGES"; payload: ChatMessage[] }
  | { type: "SET_SESSION_ID"; payload: number | null }
  | { type: "SET_LOADING_HISTORY"; payload: boolean }
  | { type: "SET_SHOW_WELCOME"; payload: boolean };

// reducer 函数
const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case "RESET":
      return {
        messages: [],
        currentSessionId: null,
        showWelcome: true,
        isLoadingHistory: false,
      };
    case "SET_HISTORY":
      return {
        ...state,
        currentSessionId: action.payload.sessionId,
        messages: action.payload.messages,
        showWelcome: action.payload.messages.length === 0,
        isLoadingHistory: false,
      };
    case "SET_MESSAGES":
      return {
        ...state,
        messages: action.payload,
      };
    case "SET_SESSION_ID":
      return {
        ...state,
        currentSessionId: action.payload,
      };
    case "SET_LOADING_HISTORY":
      return {
        ...state,
        isLoadingHistory: action.payload,
      };
    case "SET_SHOW_WELCOME":
      return {
        ...state,
        showWelcome: action.payload,
      };
    default:
      return state;
  }
};

const ChatContainer = ({
  selectedSessionId,
  onChatUpdated,
  contextDate,
}: ChatContainerProps) => {
  const [state, dispatch] = useReducer(chatReducer, {
    messages: [],
    currentSessionId: null,
    showWelcome: true,
    isLoadingHistory: false,
  });

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedSessionId == null) {
      dispatch({ type: "RESET" });
      return;
    }

    dispatch({ type: "SET_LOADING_HISTORY", payload: true });
    fetchChatHistory(selectedSessionId)
      .then((data: ChatHistoryResponse) => {
        dispatch({
          type: "SET_HISTORY",
          payload: {
            sessionId: data.session_id,
            messages: data.messages,
          },
        });
      })
      .catch(() => {
        dispatch({ type: "SET_LOADING_HISTORY", payload: false });
        dispatch({ type: "SET_SHOW_WELCOME", payload: true });
      });
  }, [selectedSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    setInputValue("");
    setIsLoading(true);
    dispatch({ type: "SET_SHOW_WELCOME", payload: false });

    sendChatMessage(
      trimmed,
      state.currentSessionId || undefined,
      contextDate ?? undefined,
    )
      .then((data: ChatHistoryResponse) => {
        dispatch({
          type: "SET_HISTORY",
          payload: {
            sessionId: data.session_id,
            messages: data.messages,
          },
        });
        onChatUpdated?.();
      })
      .catch((error) => {
        console.error("发送消息失败:", error);
        const errorMessage: ChatMessage = {
          id: Date.now(),
          author: "ai",
          text: "抱歉，发送消息失败，请检查网络连接后重试。",
          created_at: new Date().toISOString(),
        };
        dispatch({
          type: "SET_MESSAGES",
          payload: [...state.messages, errorMessage],
        });
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

  return (
    <div className={styles["chat-container"]}>
      <div className={styles["chat-header"]}>
        <FaRobot style={{ marginRight: 8 }} />
        HPC能源管家AI助手
      </div>

      <div className={styles["chat-messages"]}>
        {state.showWelcome && state.messages.length === 0 && !isLoading && (
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
        {state.messages.map((message) => (
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
            {message.author === "ai" ? (
              <div className={styles["message-content"]}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.text}
                </ReactMarkdown>
              </div>
            ) : (
              message.text
            )}
          </div>
        ))}
        {(isLoading || state.isLoadingHistory) && (
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
