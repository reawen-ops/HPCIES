import { useEffect, useState } from "react";
import {
  fetchClusterStats,
  fetchPredictionForDate,
  type ClusterStats,
} from "../../api";
import styles from "./StatisticsInfo.module.scss";

type StatisticsInfoProps = {
  avgUtilizationPercent?: number | null;
  selectedDate?: string;
};

const StatisticsInfo = ({ selectedDate }: StatisticsInfoProps) => {
  const [stats, setStats] = useState<ClusterStats | null>(null);
  const [accuracyPercent, setAccuracyPercent] = useState<number | null>(null);
  const [avgSavingEfficiency, setAvgSavingEfficiency] = useState<number | null>(
    null,
  );

  useEffect(() => {
    fetchClusterStats()
      .then(setStats)
      .catch(() => {
        // 后端不可用时，保持为空，不阻塞页面
      });
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      setAccuracyPercent(null); // 此处报错是ESLint规则过于严格导致的，实际中可以忽略
      setAvgSavingEfficiency(null);
      return;
    }

    fetchPredictionForDate(selectedDate, "今日")
      .then((resp) => {
        const predicted = resp.predicted_loads ?? [];
        const actual = resp.actual_loads ?? [];

        const hourErrorRates: number[] = [];
        const hourCount = Math.min(predicted.length, actual.length);
        for (let i = 0; i < hourCount; i += 1) {
          const p = predicted[i];
          const a = actual[i];
          if (p == null || a == null || a === 0) continue;
          hourErrorRates.push(Math.abs(p - a) / a);
        }

        if (hourErrorRates.length === 0) {
          setAccuracyPercent(null);
        } else {
          const avgErrorRate =
            hourErrorRates.reduce((sum, v) => sum + v, 0) /
            hourErrorRates.length;
          const accuracy = (1 - avgErrorRate) * 100;
          setAccuracyPercent(Math.max(0, Math.min(100, accuracy)));
        }

        const savingValues = (resp.energy_saving ?? []).filter((v) =>
          Number.isFinite(v),
        );
        if (savingValues.length === 0) {
          setAvgSavingEfficiency(null);
        } else {
          const avgSaving =
            savingValues.reduce((sum, v) => sum + v, 0) / savingValues.length;
          setAvgSavingEfficiency(avgSaving);
        }
      })
      .catch(() => {
        setAccuracyPercent(null);
        setAvgSavingEfficiency(null);
      });
  }, [selectedDate]);

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
        <div className={styles["stat-title"]}>预测准确率</div>
        <div className={styles["stat-value"]}>
          {accuracyPercent == null ? "--" : `${accuracyPercent.toFixed(1)}%`}
        </div>
      </div>
      <div className={styles["stat-item"]}>
        <div className={styles["stat-title"]}>平均节能效率</div>
        <div className={styles["stat-value"]}>
          {avgSavingEfficiency == null
            ? "--"
            : `${avgSavingEfficiency.toFixed(1)}%`}
        </div>
      </div>
    </div>
  );
};

export default StatisticsInfo;
