import styles from "./Header.module.scss";
import { FaBrain } from "react-icons/fa";

const Header = () => {
  return (
    <div className={styles.header}>
      <div className={styles.container}>
        <div className={styles.logo}>
          <FaBrain />
          <span>HPC智能节能调度系统</span>
        </div>
      </div>
    </div>
  );
};

export default Header;
