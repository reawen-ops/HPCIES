import styles from "./Header.module.scss";
import { FaBrain } from "react-icons/fa";
import { useAuth } from "../../../auth/AuthProvider";
import { useNavigate } from "react-router-dom";

const Header = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className={styles.header}>
      <div className={styles.container}>
        <div className={styles.logo}>
          <FaBrain />
          <span>HPC智能节能调度系统</span>
        </div>
        {isAuthenticated ? (
          <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ color: "#e2e8f0", fontSize: 14 }}>
              {user?.username}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: "transparent",
                border: "1px solid rgba(226, 232, 240, 0.6)",
                color: "#e2e8f0",
                padding: "6px 10px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              退出登录
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Header;
