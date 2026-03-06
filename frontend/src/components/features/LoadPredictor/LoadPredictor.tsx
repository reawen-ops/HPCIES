import { useState } from "react";
import { predictLoad } from "../../../api";
import type { LoadPredictionRequest } from "../../../api";
import styles from "./LoadPredictor.module.scss";

const LoadPredictor = () => {
  const [historyData, setHistoryData] = useState<string>("");
  const [lastTimestamp, setLastTimestamp] = useState<string>("");
  const [prediction, setPrediction] = useState<{
    predicted_load: number;
    suggested_nodes: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePredict = async () => {
    if (!historyData.trim() || !lastTimestamp.trim()) {
      setError("请输入历史数据和时间戳");
      return;
    }

    try {
      const historyArray = historyData
        .split(",")
        .map((s) => parseFloat(s.trim()));
      if (historyArray.length !== 24 || historyArray.some(isNaN)) {
        setError("历史数据必须是24个有效的数字，用逗号分隔");
        return;
      }

      setLoading(true);
      setError(null);

      const payload: LoadPredictionRequest = {
        history_24h: historyArray,
        last_timestamp: lastTimestamp,
      };

      const result = await predictLoad(payload);
      setPrediction(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "预测失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h3>HPC 负载预测</h3>
      <div className={styles.form}>
        <div className={styles.inputGroup}>
          <label>历史 24 小时 CPU 核时使用量（用逗号分隔）:</label>
          <textarea
            value={historyData}
            onChange={(e) => setHistoryData(e.target.value)}
            placeholder="输入24个数字，如：10.5, 12.3, 8.7, ..."
            rows={3}
          />
        </div>
        <div className={styles.inputGroup}>
          <label>最后时间戳 (YYYY-MM-DD HH:MM:SS):</label>
          <input
            type="text"
            value={lastTimestamp}
            onChange={(e) => setLastTimestamp(e.target.value)}
            placeholder="例如：2025-11-15 23:00:00"
          />
        </div>
        <button
          onClick={handlePredict}
          disabled={loading}
          className={styles.predictButton}
        >
          {loading ? "预测中..." : "开始预测"}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {prediction && (
        <div className={styles.result}>
          <h4>预测结果</h4>
          <p>预测负载: {prediction.predicted_load.toFixed(2)}</p>
          <p>建议开启节点数: {prediction.suggested_nodes} 台</p>
        </div>
      )}
    </div>
  );
};

export default LoadPredictor;
