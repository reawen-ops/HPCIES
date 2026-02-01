import styles from "./RegisterForm.module.scss";
import { IoLogoWechat } from "react-icons/io5";
import { FaQq } from "react-icons/fa";
import { FaAlipay } from "react-icons/fa";

const RegisterForm = () => {
  return (
    <div className={styles.card}>
      <form id="register-form">
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
          />
        </div>

        <div className={styles["form-group"]}>
          <label className={styles["form-label"]} htmlFor="verification-code">
            验证码
          </label>
          <div className={styles.verification}>
            <input
              type="text"
              id="verification-code"
              className={styles["form-control"]}
              placeholder="请输入手机验证码"
              required
            />
            <button
              type="button"
              className={
                styles.btn + " " + styles["btn-secondary"] + " " + styles.button
              }
            >
              获取验证码
            </button>
          </div>
        </div>

        <button
          type="submit"
          className={
            styles.btn + " " + styles["btn-primary"] + " " + styles["btn-block"]
          }
        >
          注册
        </button>

        <div className={styles.divider + " " + styles.mt20}>
          <span>或使用以下方式注册</span>
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

        <p className={styles["text-center"] + " " + styles.mt20}>
          已有账户？
          <a href="#" className={styles.link} id="go-to-login">
            立即登录
          </a>
        </p>
      </form>
    </div>
  );
};

export default RegisterForm;
