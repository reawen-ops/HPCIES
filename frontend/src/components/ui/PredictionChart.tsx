import React, { useEffect, useState, useCallback, useMemo } from "react";
import { FaBolt, FaChartLine, FaLeaf, FaTasks } from "react-icons/fa";
import {
  fetchClusterStats,
  fetchPredictionForDate,
  type ClusterStats,
  type PredictionResponse,
} from "../../api";
import styles from "./PredictionChart.module.scss";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTooltip,
  ChartLegend,
);

type RangeOption = "今日" | "未来3天" | "未来7天";
type DisplayMode = "全部" | "仅实际" | "仅预测";

interface PredictionChartProps {
  selectedDate: string;
  onChangeDate: (date: string) => void;
  onPredictionUpdated?: () => void;
  onDailyPredictedCoreHoursChange?: (dailyPredictedCoreHours: number | null) => void;
}

const RUNNING_POWER_PER_HOUR = 20;
const STANDBY_POWER_PER_HOUR = 8;

const PredictionChart = ({
  selectedDate,
  onChangeDate,
  onPredictionUpdated,
  onDailyPredictedCoreHoursChange,
}: PredictionChartProps) => {
  const DATE_MIN = "2025-04-01";
  const DATE_MAX = "2025-11-30";
  const [range] = useState<RangeOption>("今日");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("仅预测");
  const [data, setData] = useState<PredictionResponse | null>(null);
  const [clusterStats, setClusterStats] = useState<ClusterStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // fetch 封装，允许传递范围（range）给后端
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchPredictionForDate(selectedDate, range);

      // 检查返回的数据是否有效
      if (!resp.labels || resp.labels.length === 0) {
        setError("该日期暂无预测数据，请确保已上传足够的历史数据");
        setData(null);
        onDailyPredictedCoreHoursChange?.(null);
        return;
      }

      const predictedLoads = (resp.predicted_loads as (number | null)[] | undefined) ?? [];
      const dailyPredictedCoreHours = predictedLoads.reduce<number>(
        (sum, v) => sum + (v == null ? 0 : v),
        0,
      );
      onDailyPredictedCoreHoursChange?.(dailyPredictedCoreHours);

      setData({
        labels: resp.labels ?? [],
        // 实际曲线：若存在 actual_loads 则优先使用，否则退化为预测负载
        full_load:
          (resp.actual_loads as (number | null)[] | undefined)?.map((v) =>
            v == null ? 0 : v,
          ) ??
          (resp.predicted_loads as number[] | undefined) ??
          [],
        // 对比曲线：节能预测（来自 LSTM）
        energy_saving: (resp.predicted_loads as number[] | undefined) ?? [],
        history_avg: (
          resp.history_avg_loads as (number | null)[] | undefined
        )?.map((v) => (v == null ? 0 : v)),
        strategy: {
          sleep_periods: resp.strategy?.sleep_periods ?? "数据待获取",
          running_nodes: resp.strategy?.running_nodes ?? "0 个（0%）",
          to_sleep_nodes: resp.strategy?.to_sleep_nodes ?? "0 个（0%）",
          sleeping_nodes: resp.strategy?.sleeping_nodes ?? "0 个（0%）",
        },
        effects: {
          avg_utilization: resp.effects?.avg_utilization ?? "0%",
          optimized_utilization: resp.effects?.optimized_utilization ?? "0%",
          load_stability: resp.effects?.load_stability ?? "数据待获取",
          peak_utilization: resp.effects?.peak_utilization ?? "0%",
          min_utilization: resp.effects?.min_utilization ?? "0%",
          utilization_range: resp.effects?.utilization_range ?? "0% - 0%",
        },
        impact: {
          delay: resp.impact?.delay ?? "数据待获取",
          queue_risk: resp.impact?.queue_risk ?? "数据待获取",
          immediate_capacity: resp.impact?.immediate_capacity ?? "数据待获取",
          emergency_response: resp.impact?.emergency_response ?? "数据待获取",
        },
      });

      onPredictionUpdated?.();
    } catch (err: any) {
      console.error(err);

      // 更详细的错误提示
      const detail: string | undefined = err.response?.data?.detail;
      if (detail) {
        setError(detail);
      } else if (err.code === "ECONNABORTED") {
        setError("预测服务请求超时，请检查后端服务或网络连接");
      } else if (err.response?.status === 400) {
        setError("历史数据不足或日期格式错误，请检查上传的数据");
      } else if (err.response?.status === 503) {
        setError("预测服务暂时不可用，请稍后重试");
      } else if (err.response?.status === 401) {
        setError("登录已过期，请重新登录");
      } else {
        setError("获取预测失败，请稍后重试");
      }
      setData(null);
      onDailyPredictedCoreHoursChange?.(null);
    } finally {
      setLoading(false);
    }
  }, [
    selectedDate,
    range,
    onPredictionUpdated,
    onDailyPredictedCoreHoursChange,
  ]);

  // 日期或范围变化时重新拉取
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchClusterStats()
      .then(setClusterStats)
      .catch(() => {
        setClusterStats(null);
      });
  }, []);

  // 预测范围控制已从 UI 中移除，保留 range 状态以便将来扩展（当前固定为“今日”）

  const onModeClick = (mode: DisplayMode) => {
    setDisplayMode(mode);
  };
  const handleDateChange = (nextDate: string) => {
    if (nextDate < DATE_MIN || nextDate > DATE_MAX) {
      return;
    }
    onChangeDate(nextDate);
  };

  const chartData = useMemo(() => {
    if (!data) {
      return { labels: [], datasets: [] };
    }
    const labels = data.labels ?? [];

    const showActual = displayMode === "全部" || displayMode === "仅实际";
    const showPredicted = displayMode === "全部" || displayMode === "仅预测";

    return {
      labels,
      datasets: [
        {
          label: "当天实际",
          data: data.full_load ?? [],
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.15)",
          tension: 0.3,
          fill: true,
          hidden: !showActual,
        },
        {
          label: "节能预测",
          data: data.energy_saving ?? [],
          borderColor: "#f97316",
          backgroundColor: "rgba(249, 115, 22, 0.12)",
          tension: 0.3,
          fill: false,
          borderWidth: 2,
          hidden: !showPredicted,
        },
      ],
    };
  }, [data, displayMode]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "nearest" as const,
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const label = ctx.dataset.label || "";
              const value = ctx.parsed.y;
              return `${label}: ${value.toFixed(1)} 核时`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            maxRotation: 0,
          },
        },
        y: {
          grid: {
            color: "#e5e7eb",
          },
          ticks: {
            callback: (value: any) => `${value}`,
          },
        },
      },
    }),
    [],
  );

  const energyMetrics = useMemo(() => {
    if (!data || !clusterStats || clusterStats.core_per_node <= 0 || clusterStats.total_nodes <= 0) {
      return null;
    }

    const parseNodeCount = (value: string | undefined): number => {
      if (!value) return 0;
      const matched = value.match(/(\d+)\s*个/);
      return matched ? Number(matched[1]) : 0;
    };

    const suggestedRunningNodes = parseNodeCount(data.strategy?.running_nodes);
    const suggestedStandbyNodes = parseNodeCount(data.strategy?.to_sleep_nodes);
    const totalNodes = clusterStats.total_nodes;
    const corePerNode = clusterStats.core_per_node;

    const actualDailyEstimatedEnergy = (data.full_load ?? []).reduce((sum, load) => {
      const runningNodes = Math.min(
        totalNodes,
        Math.max(0, Math.ceil((load ?? 0) / corePerNode)),
      );
      const standbyNodes = Math.max(0, totalNodes - runningNodes);
      const hourEnergy =
        runningNodes * RUNNING_POWER_PER_HOUR +
        standbyNodes * STANDBY_POWER_PER_HOUR;
      return sum + hourEnergy;
    }, 0);

    const suggestedDailyEnergy =
      suggestedRunningNodes * RUNNING_POWER_PER_HOUR * 24 +
      suggestedStandbyNodes * STANDBY_POWER_PER_HOUR * 24;

    const savingEfficiency =
      actualDailyEstimatedEnergy > 0
        ? ((actualDailyEstimatedEnergy - suggestedDailyEnergy) /
            actualDailyEstimatedEnergy) *
          100
        : null;

    return {
      suggestedDailyEnergy,
      actualDailyEstimatedEnergy,
      savingEfficiency,
    };
  }, [clusterStats, data]);

  // render 阶段可能抛出错误，使用 try/catch 包装
  let content: React.ReactElement;
  try {
    content = (
      <section className={styles["prediction-section"]}>
        <div className={styles["chart-container"]}>
          <div className={styles["chart-header"]}>
            <h3 className={styles["chart-title"]}>
              <FaChartLine />
              {selectedDate} 核使用量对比曲线
            </h3>
            {data && (
              <div className={styles["chart-legend"]}>
                <div className={styles["legend-item"]}>
                  <span
                    className={
                      styles["legend-color"] + " " + styles["color-open"]
                    }
                  />
                  <span>当天实际</span>
                </div>
                <div className={styles["legend-item"]}>
                  <span
                    className={
                      styles["legend-color"] + " " + styles["color-closed"]
                    }
                  />
                  <span>节能预测</span>
                </div>
              </div>
            )}
          </div>
          <div className={styles["chart-controls"]}>
            <input
              aria-label="选择预测日期"
              type="date"
              min={DATE_MIN}
              max={DATE_MAX}
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
            />
          </div>
          <div className={styles["chart-content"]}>
            {loading && <span>加载中…</span>}
            {error && <span className={styles["error-text"]}>{error}</span>}
            {!loading &&
              !error &&
              (() => {
                const hasData =
                  data !== null &&
                  Array.isArray(data.full_load) &&
                  data.full_load.length > 0;
                return hasData ? (
                  <>
                    <Line data={chartData} options={chartOptions} />
                  </>
                ) : (
                  <span>预测数据待获取</span>
                );
              })()}
          </div>

          <div className={styles["chart-inline-controls"]}>
            <div className={styles["control-group"]}>
              <span className={styles["control-label"]}>显示模式</span>
              <div className={styles["control-buttons"]}>
                {(["全部", "仅实际", "仅预测"] as DisplayMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={
                      styles["control-btn"] +
                      " " +
                      (displayMode === mode ? styles["control-btn-active"] : "")
                    }
                    onClick={() => onModeClick(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className={styles["control-btn"]}
              disabled={loading}
              onClick={fetchData}
            >
              {loading ? "计算中…" : "重新计算预测"}
            </button>
          </div>
        </div>

        <div className={styles["prediction-details"]}>
          <div className={styles["detail-card"]}>
            <div className={styles["detail-header"]}>
              <FaBolt />
              <h4>节能策略</h4>
            </div>
            <div className={styles["detail-content"]}>
              <div className={styles["detail-item"]}>
                <span className={styles["detail-label"]}>建议休眠时段</span>
                <span className={styles["detail-value"]}>
                  {data?.strategy?.sleep_periods ?? "数据待获取"}
                </span>
              </div>
              <div className={styles["detail-item"]}>
                <span className={styles["detail-label"]}>节点状态建议</span>
                <div className={styles["status-list"]}>
                  <div className={styles["status-item"]}>
                    <span className={styles["status-label"]}>
                      <span
                        className={`${styles["status-dot"]} ${styles["status-dot-running"]}`}
                      />
                      运行
                    </span>
                    <span className={styles["status-value"]}>
                      {data?.strategy?.running_nodes ?? "0 个（0%）"}
                    </span>
                  </div>
                  <div className={styles["status-item"]}>
                    <span className={styles["status-label"]}>
                      <span
                        className={`${styles["status-dot"]} ${styles["status-dot-to-sleep"]}`}
                      />
                      待机
                    </span>
                    <span className={styles["status-value"]}>
                      {data?.strategy?.to_sleep_nodes ?? "0 个（0%）"}
                    </span>
                  </div>
                  <div className={styles["status-item"]}>
                    <span className={styles["status-label"]}>
                      <span
                        className={`${styles["status-dot"]} ${styles["status-dot-sleeping"]}`}
                      />
                      关机
                    </span>
                    <span className={styles["status-value"]}>
                      {data?.strategy?.sleeping_nodes ?? "0 个（0%）"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles["detail-card"]}>
            <div className={styles["detail-header"]}>
              <FaLeaf />
              <h4>负载特征</h4>
            </div>
            <div className={styles["detail-content"]}>
              <div className={styles["status-list"]}>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>单节点运行功率</span>
                  <span className={styles["status-value"]}>
                    {RUNNING_POWER_PER_HOUR}KWh/24h
                  </span>
                </div>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>单节点待机态功率</span>
                  <span className={styles["status-value"]}>
                    {STANDBY_POWER_PER_HOUR}KWh/24h
                  </span>
                </div>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>建议策略日耗电量</span>
                  <span className={styles["status-value"]}>
                    {energyMetrics
                      ? `${energyMetrics.suggestedDailyEnergy.toFixed(1)} kWh`
                      : "数据待获取"}
                  </span>
                </div>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>实际日耗电估算量</span>
                  <span className={styles["status-value"]}>
                    {energyMetrics
                      ? `${energyMetrics.actualDailyEstimatedEnergy.toFixed(1)} kWh`
                      : "数据待获取"}
                  </span>
                </div>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>节能效率</span>
                  <span className={styles["status-value"]}>
                    {energyMetrics?.savingEfficiency == null
                      ? "数据待获取"
                      : `${energyMetrics.savingEfficiency.toFixed(2)}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles["detail-card"]}>
            <div className={styles["detail-header"]}>
              <FaTasks />
              <h4>任务影响</h4>
            </div>
            <div className={styles["detail-content"]}>
              <div className={styles["status-list"]}>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>预计任务延迟</span>
                  <span className={styles["status-value"]}>
                    {data?.impact?.delay ?? "数据待获取"}
                  </span>
                </div>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>队列积压风险</span>
                  <span className={styles["status-value"]}>
                    {data?.impact?.queue_risk ?? "数据待获取"}
                  </span>
                </div>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>可立即启动容量</span>
                  <span className={styles["status-value"]}>
                    {data?.impact?.immediate_capacity ??
                      data?.strategy?.to_sleep_nodes ??
                      "数据待获取"}
                  </span>
                </div>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>紧急响应能力</span>
                  <span className={styles["status-value"]}>
                    {data?.impact?.emergency_response ?? "数据待获取"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  } catch (err) {
    console.error("PredictionChart render error", err);
    content = <div className={styles["error-text"]}>图表组件渲染失败</div>;
  }
  return content;
};

export default PredictionChart;
