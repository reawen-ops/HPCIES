import styles from "./Sidebar.module.scss";
import { BsDatabaseFill } from "react-icons/bs";
import { FaFolder, FaHistory } from "react-icons/fa";

const Sidebar = () => {
  return (
    <div className={styles.sidebar}>
      <div className={styles["sidebar-section"]}>
        <div className={styles["sidebar-title"]}>
          <BsDatabaseFill />
          数据详情
        </div>
        <ul className={styles["tree-view"]} id="data-tree">
          <li className={styles["tree-item"]}>
            <FaFolder />
            暂无数据
          </li>
        </ul>
      </div>

      <div className={styles["sidebar-section"]}>
        <div className={styles["sidebar-title"]}>
          <FaHistory />
          对话历史
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
