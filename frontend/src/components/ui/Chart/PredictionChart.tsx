import React, { useEffect, useRef, useState, useCallback } from "react";
import { FaBolt, FaChartLine, FaLeaf, FaTasks } from "react-icons/fa";
import { fetchPredictionForDate, type PredictionResponse } from "../../../api";
import styles from "./PredictionChart.module.scss";

type RangeOption = "今日" | "未来3天" | "未来7天";
type DisplayMode = "对比模式" | "仅全开" | "仅节能";

interface PredictionChartProps {
  selectedDate: string;
  onChangeDate: (date: string) => void;
}

const PredictionChart = ({
  selectedDate,
  onChangeDate,
}: PredictionChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [range, setRange] = useState<RangeOption>("今日");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("对比模式");
  const [data, setData] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 绘图逻辑只依赖 displayMode 和最新的数据；外围 catch 防止偶发异常导致整个组件挂掉
  useEffect(() => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const full = data?.full_load ?? [];
      const save = data?.energy_saving ?? [];
      if (full.length > 0 && save.length > 0) {
        drawChart(ctx, displayMode, full, save);
      }
    } catch (err) {
      console.error("绘制预测曲线失败", err);
    }
  }, [displayMode, data]);

  // fetch 封装，允许传递范围（range）给后端
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchPredictionForDate(selectedDate, range);
      setData({
        labels: resp.labels ?? [],
        full_load: resp.utilization ?? [],
        energy_saving: resp.energy_saving ?? [],
        strategy: resp.strategy,
        effects: resp.effects,
        impact: resp.impact,
      });
    } catch (err) {
      console.error(err);
      setError("获取预测失败，请稍后重试");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, range]);

  // 日期或范围变化时重新拉取
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRangeClick = (option: RangeOption) => {
    if (option === range) return;
    setRange(option);
    // fetchData 由 effect 自动触发
  };

  const onModeClick = (mode: DisplayMode) => {
    setDisplayMode(mode);
  };

  // render 阶段可能抛出错误，使用 try/catch 包装
  let content: React.ReactElement;
  try {
    content = (
      <section className={styles["prediction-section"]}>
        <div className={styles["chart-container"]}>
          <div className={styles["chart-header"]}>
            <h3 className={styles["chart-title"]}>
              <FaChartLine />
              {selectedDate} 核使用率预测曲线
            </h3>
            {data && (
              <div className={styles["chart-legend"]}>
                <div className={styles["legend-item"]}>
                  <span
                    className={
                      styles["legend-color"] + " " + styles["color-open"]
                    }
                  />
                  <span>全开模式</span>
                </div>
                <div className={styles["legend-item"]}>
                  <span
                    className={
                      styles["legend-color"] + " " + styles["color-saving"]
                    }
                  />
                  <span>节能模式</span>
                </div>
              </div>
            )}
          </div>
          <div className={styles["chart-controls"]}>
            <input
              aria-label="选择预测日期"
              type="date"
              value={selectedDate}
              onChange={(e) => onChangeDate(e.target.value)}
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
                  data.full_load.length > 0 &&
                  Array.isArray(data.energy_saving) &&
                  data.energy_saving.length > 0;
                return hasData ? (
                  <canvas
                    ref={canvasRef}
                    id="prediction-chart"
                    width={900}
                    height={180}
                  />
                ) : (
                  <span>预测数据待获取</span>
                );
              })()}
          </div>
          <div className={styles["time-axis"]}>
            {data?.labels?.length
              ? data.labels.map((label) => <span key={label}>{label}</span>)
              : null}
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
                      必须运行
                    </span>
                    <span className={styles["status-value"]}>
                      {data?.strategy?.node_distribution?.running ??
                        "0 个（0%）"}
                    </span>
                  </div>
                  <div className={styles["status-item"]}>
                    <span className={styles["status-label"]}>
                      <span
                        className={`${styles["status-dot"]} ${styles["status-dot-to-sleep"]}`}
                      />
                      待休眠
                    </span>
                    <span className={styles["status-value"]}>
                      {data?.strategy?.node_distribution?.to_sleep ??
                        "0 个（0%）"}
                    </span>
                  </div>
                  <div className={styles["status-item"]}>
                    <span className={styles["status-label"]}>
                      <span
                        className={`${styles["status-dot"]} ${styles["status-dot-sleeping"]}`}
                      />
                      休眠
                    </span>
                    <span className={styles["status-value"]}>
                      {data?.strategy?.node_distribution?.sleeping ??
                        "0 个（0%）"}
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles["detail-item"]}>
                <span className={styles["detail-label"]}>提前唤醒时间</span>
                <span className={styles["detail-value"]}>
                  {data?.strategy?.wake_ahead ?? "数据待获取"}
                </span>
              </div>
            </div>
          </div>

          <div className={styles["detail-card"]}>
            <div className={styles["detail-header"]}>
              <FaLeaf />
              <h4>节能效果</h4>
            </div>
            <div className={styles["detail-content"]}>
              <div className={styles["status-list"]}>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>预计节能</span>
                  <span
                    className={
                      styles["status-value"] +
                      " " +
                      styles["detail-value-highlight"]
                    }
                  >
                    {data?.effects?.saving_percent ?? "0%"}
                  </span>
                </div>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>节省核时</span>
                  <span className={styles["status-value"]}>
                    {data?.effects?.saving_core_hours ?? "0 核时/天"}
                  </span>
                </div>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>节省电力</span>
                  <span className={styles["status-value"]}>
                    {data?.effects?.saving_power ?? "~0 kWh/天"}
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
                  <span className={styles["status-label"]}>紧急响应能力</span>
                  <span className={styles["status-value"]}>
                    {data?.impact?.emergency_response ?? "数据待获取"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles["prediction-controls"]}>
          <div className={styles["control-group"]}>
            <span className={styles["control-label"]}>预测范围</span>
            <div className={styles["control-buttons"]}>
              {(["今日", "未来3天", "未来7天"] as RangeOption[]).map(
                (option) => (
                  <button
                    key={option}
                    type="button"
                    className={
                      styles["control-btn"] +
                      " " +
                      (range === option ? styles["control-btn-active"] : "")
                    }
                    onClick={() => onRangeClick(option)}
                  >
                    {option}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className={styles["control-group"]}>
            <span className={styles["control-label"]}>显示模式</span>
            <div className={styles["control-buttons"]}>
              {(["对比模式", "仅全开", "仅节能"] as DisplayMode[]).map(
                (mode) => (
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
                ),
              )}
            </div>
          </div>

          <div className={styles["control-group"]}>
            <span className={styles["control-label"]}>更新频率</span>
            <select
              className={styles["control-select"]}
              defaultValue="每小时更新"
              aria-label="选择预测数据更新频率"
            >
              <option>实时更新</option>
              <option>每小时更新</option>
              <option>每6小时更新</option>
              <option>每日更新</option>
            </select>
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
      </section>
    );
  } catch (err) {
    console.error("PredictionChart render error", err);
    content = <div className={styles["error-text"]}>图表组件渲染失败</div>;
  }
  return content;
};

function drawChart(
  ctx: CanvasRenderingContext2D,
  displayMode: DisplayMode,
  fullLoadData: number[],
  energySavingData: number[],
) {
  const { canvas } = ctx;
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  // 背景
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  // 网格
  ctx.strokeStyle = "#e0e0e0";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 5; i += 1) {
    const y = 15 + i * 30;
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(width - 30, y);
    ctx.stroke();

    ctx.fillStyle = "#546e7a";
    ctx.font = "10px Arial";
    ctx.fillText(`${(5 - i) * 20}%`, 8, y + 3);
  }

  const maxValue = 100;
  const scaleY = (height - 50) / maxValue;
  const pointsCount = fullLoadData.length;
  const stepX = (width - 60) / Math.max(pointsCount - 1, 1);

  const drawDataLine = (data: number[], color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((value, index) => {
      const x = 30 + index * stepX;
      const y = height - 30 - value * scaleY;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      // 数据点
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.stroke();

    // 填充区域
    ctx.fillStyle = `${color}20`;
    ctx.beginPath();
    ctx.moveTo(30, height - 30);
    data.forEach((value, index) => {
      const x = 30 + index * stepX;
      const y = height - 30 - value * scaleY;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(30 + (data.length - 1) * stepX, height - 30);
    ctx.closePath();
    ctx.fill();
  };

  if (displayMode === "对比模式" || displayMode === "仅全开") {
    drawDataLine(fullLoadData, "#4caf50");
  }

  if (displayMode === "对比模式" || displayMode === "仅节能") {
    drawDataLine(energySavingData, "#1e88e5");
  }
}

export default PredictionChart;
