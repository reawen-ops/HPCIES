import styles from "./RegisterForm.module.scss";
import { Link, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";

const RegisterForm = () => {
  const navigate = useNavigate();
  const { register, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    setSubmitting(true);
    try {
      await register(username, password);
      await login(username, password);
      window.sessionStorage.setItem("show-data-source-notice", "1");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.card}>
      <form id="register-form" onSubmit={onSubmit}>
        <div className={styles["form-group"]}>
          <label className={styles["form-label"]} htmlFor="username">
            用户名
          </label>
          <input
            type="text"
            id="username"
            className={styles["form-control"]}
            placeholder="请输入用户名"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className={styles["form-group"]}>
          <label className={styles["form-label"]} htmlFor="phone">
            手机号
          </label>
          <input
            type="tel"
            id="phone"
            className={styles["form-control"]}
            placeholder="请输入手机号"
            required
          />
        </div>

        <div className={styles["form-group"]}>
          <label className={styles["form-label"]} htmlFor="email">
            邮箱（可选）
          </label>
          <input
            type="email"
            id="email"
            className={styles["form-control"]}
            placeholder="请输入邮箱"
          />
        </div>

        <div className={styles["form-group"]}>
          <label className={styles["form-label"]} htmlFor="password">
            密码
          </label>
          <input
            type="password"
            id="password"
            className={styles["form-control"]}
            placeholder="请输入密码"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className={styles["form-group"]}>
          <label className={styles["form-label"]} htmlFor="confirm-password">
            确认密码
          </label>
          <input
            type="password"
            id="confirm-password"
            className={styles["form-control"]}
            placeholder="请再次输入密码"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={
            styles.btn + " " + styles["btn-primary"] + " " + styles["btn-block"]
          }
        >
          {submitting ? "注册中..." : "注册"}
        </button>

        {error ? (
          <div className={styles.mt20} style={{ color: "#d32f2f" }}>
            {error}
          </div>
        ) : null}

        <p className={styles["text-center"] + " " + styles.mt20}>
          已有账户？
          <Link to="/login" className={styles.link}>
            立即登录
          </Link>
        </p>
      </form>
    </div>
  );
};

export default RegisterForm;
