import React from "react";
import styles from "./RegisterPage.module.scss";
import Header from "../../components/layout/Header/Header";
import RegisterForm from "../../components/forms/RegisterForm";

interface RegisterPageProps {
  title?: string;
}

class RegisterPage extends React.Component<RegisterPageProps> {
  render() {
    return (
      <div>
        <Header />
        <div className={styles.container}>
          <h1 className={styles["page-title"]}>账号注册</h1>
          <RegisterForm />
        </div>
      </div>
    );
  }
}

export default RegisterPage;
