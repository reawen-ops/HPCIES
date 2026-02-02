import styles from "./StatisticsInfo.module.scss";

const StatisticsInfo = () => {
  return (
    <div className={styles["stats-card"]}>
      <div className={styles["stat-item"]}>
        <div className={styles["stat-title"]}>今日预计节能</div>
        <div className={styles["stat-value"]}>24.5%</div>
      </div>
      <div className={styles["stat-item"]}>
        <div className={styles["stat-title"]}>总节点数</div>
        <div className={styles["stat-value"]}>128</div>
      </div>
      <div className={styles["stat-item"]}>
        <div className={styles["stat-title"]}>当前运行节点</div>
        <div className={styles["stat-value"]}>84</div>
      </div>
      <div className={styles["stat-item"]}>
        <div className={styles["stat-title"]}>今日任务数</div>
        <div className={styles["stat-value"]}>312</div>
      </div>
    </div>
  );
};

export default StatisticsInfo;
