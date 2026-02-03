import styles from "./LoginForm.module.scss";
import { IoLogoWechat } from "react-icons/io5";
import { FaQq } from "react-icons/fa";
import { FaAlipay } from "react-icons/fa";
import { Link } from "react-router-dom";

const LoginForm = () => {
  return (
    <div className={styles.card}>
      <form id="login-form">
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

        <button
          type="submit"
          className={
            styles["btn"] +
            " " +
            styles["btn-primary"] +
            " " +
            styles["btn-block"]
          }
        >
          登录
        </button>

        <div className={styles.divider + " " + styles["mt-20"]}>
          <span>或使用以下方式登录</span>
        </div>

        <div className={styles["social-login"]}>
          <div className={styles["social-btn"] + " " + styles.wechat}>
            <IoLogoWechat />
          </div>
          <div className={styles["social-btn"] + " " + styles.qq}>
            <FaQq />
          </div>
          <div className={styles["social-btn"] + " " + styles.alipay}>
            <FaAlipay />
          </div>
        </div>

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
