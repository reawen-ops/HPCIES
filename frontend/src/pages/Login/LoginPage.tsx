import React from "react";
import styles from "./LoginPage.module.scss";
import Header from "../../components/layout/Header/Header";
import LoginForm from "../../components/forms/LoginForm";

interface LoginPageProps {
  title?: string;
}

class LoginPage extends React.Component<LoginPageProps> {
  constructor(props: LoginPageProps) {
    super(props);
    this.state = { title: props.title || "登录页面" };
  }

  render() {
    return (
      <div>
        <Header />
        <div className={styles.container}>
          <h1 className={styles["page-title"]}>账密登录</h1>
          <LoginForm />
        </div>
      </div>
    );
  }
}

export default LoginPage;
