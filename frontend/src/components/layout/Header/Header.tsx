import styles from "./Header.module.scss";
import { FaBrain, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { useAuth } from "../../../auth/AuthProvider";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Header = ({ collapsed = false, onToggleCollapse }: HeaderProps) => {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className={`${styles.header} ${collapsed ? styles["header-collapsed"] : ""}`}>
      <button
        type="button"
        className={styles["header-toggle"]}
        onClick={onToggleCollapse}
        aria-label={collapsed ? "展开顶部栏" : "收起顶部栏"}
        title={collapsed ? "展开顶部栏" : "收起顶部栏"}
      >
        {collapsed ? <FaChevronDown /> : <FaChevronUp />}
      </button>
      <div className={styles.container}>
        {isAuthenticated && (
          <div className={styles["user-area"]}>
            <span className={styles["user-name"]}>{user?.username}</span>
            <button
              type="button"
              onClick={handleLogout}
              className={styles["logout-button"]}
            >
              退出登录
            </button>
          </div>
        )}
        <div className={styles.logo}>
          <FaBrain />
          <span>HPC智能节能调度系统</span>
        </div>
        <div className={styles["source-text"]}>
          本系统所有数据均来自
          <a
            href="https://hpc.ncepu.edu.cn"
            target="_blank"
            rel="noreferrer noopener"
            className={styles["source-link"]}
          >
            华北电力大学高性能计算平台
          </a>
        </div>
      </div>
    </div>
  );
};

export default Header;
