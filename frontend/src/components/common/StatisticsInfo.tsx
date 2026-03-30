import { useEffect, useState } from "react";
import { fetchClusterStats, type ClusterStats } from "../../api";
import styles from "./StatisticsInfo.module.scss";

type StatisticsInfoProps = {
  avgUtilizationPercent?: number | null;
};

const StatisticsInfo = ({ avgUtilizationPercent }: StatisticsInfoProps) => {
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
        <div className={styles["stat-title"]}>总节点数</div>
        <div className={styles["stat-value"]}>
          {stats ? stats.total_nodes : "--"}
        </div>
      </div>
      <div className={styles["stat-item"]}>
        <div className={styles["stat-title"]}>总核心数</div>
        <div className={styles["stat-value"]}>
          {stats ? `${stats.total_cores} 核` : "--"}
        </div>
      </div>
      <div className={styles["stat-item"]}>
        <div className={styles["stat-title"]}>平均利用率</div>
        <div className={styles["stat-value"]}>
          {avgUtilizationPercent == null ? "--" : `${avgUtilizationPercent.toFixed(1)}%`}
        </div>
      </div>
      <div className={styles["stat-item"]}>
        <div className={styles["stat-title"]}>历史数据</div>
        <div className={styles["stat-value"]}>
          {stats ? `${stats.data_days} 天` : "--"}
        </div>
      </div>
    </div>
  );
};

export default StatisticsInfo;
