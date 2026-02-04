import { useEffect, useState } from "react";
import { fetchClusterStats, type ClusterStats } from "../../api";
import styles from "./StatisticsInfo.module.scss";

const StatisticsInfo = () => {
  const [stats, setStats] = useState<ClusterStats | null>(null);

  useEffect(() => {
    fetchClusterStats()
      .then(setStats)
      .catch(() => {
        // 后端不可用时，保持为空，不阻塞页面
      });
  }, []);

  return (
    <div className={styles["stats-card"]}>
      <div className={styles["stat-item"]}>
        <div className={styles["stat-title"]}>今日预计节能</div>
        <div className={styles["stat-value"]}>
          {stats?.today_saving_percent != null
            ? `${stats.today_saving_percent.toFixed(1)}%`
            : "训练中"}
        </div>
      </div>
      <div className={styles["stat-item"]}>
        <div className={styles["stat-title"]}>总节点数</div>
        <div className={styles["stat-value"]}>
          {stats ? stats.total_nodes : "--"}
        </div>
      </div>
      <div className={styles["stat-item"]}>
        <div className={styles["stat-title"]}>当前运行节点</div>
        <div className={styles["stat-value"]}>
          {stats?.running_nodes != null ? stats.running_nodes : "训练中"}
        </div>
      </div>
      <div className={styles["stat-item"]}>
        <div className={styles["stat-title"]}>今日预计任务数</div>
        <div className={styles["stat-value"]}>
          {stats?.today_tasks != null ? stats.today_tasks : "训练中"}
        </div>
      </div>
    </div>
  );
};

export default StatisticsInfo;
