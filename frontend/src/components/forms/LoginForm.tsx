import styles from "./LoginForm.module.scss";
import { Link, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";

const LoginForm = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.card}>
      <form id="login-form" onSubmit={onSubmit}>
        <div className={styles["form-group"]}>
          <label className={styles["form-label"]} htmlFor="login-username">
            用户名
          </label>
          <input
            type="text"
            id="login-username"
            className={styles["form-control"]}
            placeholder="请输入用户名"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className={styles["form-group"]}>
          <label className={styles["form-label"]} htmlFor="login-password">
            密码
          </label>
          <input
            type="password"
            id="login-password"
            className={styles["form-control"]}
            placeholder="请输入密码"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className={styles["form-group-inline"]}>
          <div>
            <input type="checkbox" id="remember-me" />
            <label htmlFor="remember-me">记住我</label>
          </div>
          <a href="#" className={styles.link}>
            忘记密码？
          </a>
        </div>

        {error ? (
          <div className={styles["mt-20"]} style={{ color: "#d32f2f" }}>
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className={
            styles["btn"] +
            " " +
            styles["btn-primary"] +
            " " +
            styles["btn-block"]
          }
        >
          {submitting ? "登录中..." : "登录"}
        </button>

        <p className={styles["text-center"] + " " + styles["mt-20"]}>
          还没有账户？
          <Link to="/register" className={styles.link}>
            立即注册
          </Link>
        </p>
      </form>
    </div>
  );
};

export default LoginForm;
