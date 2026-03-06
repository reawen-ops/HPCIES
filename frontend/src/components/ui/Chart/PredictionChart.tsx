import { useEffect, useRef, useState } from "react";
import { FaBolt, FaChartLine, FaLeaf, FaTasks } from "react-icons/fa";
import {
  fetchPredictionForDate,
  type PredictionResponse,
  type DatePredictionResponse,
} from "../../../api";
import styles from "./PredictionChart.module.scss";

type RangeOption = "今日" | "未来3天" | "未来7天";
type DisplayMode = "对比模式" | "仅全开" | "仅节能";

const PredictionChart = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [range, setRange] = useState<RangeOption>("今日");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("对比模式");
  const [data, setData] = useState<PredictionResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (data && data.full_load.length > 0 && data.energy_saving.length > 0) {
      drawChart(ctx, displayMode, data.full_load, data.energy_saving);
    }
  }, [displayMode, range, data]);

  useEffect(() => {
    // 当选择日期变化时重新获取预测
    fetchPredictionForDate(selectedDate)
      .then((resp: DatePredictionResponse) => {
        const full = resp.predicted_loads.map((v) => (v === null ? 0 : v));
        const saving = resp.predicted_loads.map(() => 0);
        // 保留原有硬编码策略信息，或根据 resp.date 动态生成
        setData({
          labels: resp.labels,
          full_load: full,
          energy_saving: saving,
          strategy: {
            sleep_periods: "02:00-06:00, 14:00-16:00",
            node_distribution: {
              running: "64 个（50%）",
              to_sleep: "20 个（16%）",
              sleeping: "44 个（34%）",
            },
            wake_ahead: "高峰前30分钟",
          },
          effects: {
            saving_percent: "24.5%",
            saving_core_hours: "1,248 核时/天",
            saving_power: "~312 kWh/天",
          },
          impact: {
            delay: "≤ 15分钟",
            queue_risk: "低",
            emergency_response: "30分钟内恢复全部节点",
          },
        });
      })
      .catch(() => {
        // 忽略错误
      });
  }, [selectedDate]);

  const onRangeClick = (option: RangeOption) => {
    setRange(option);
    // 这里预留将来根据范围调用后端接口更新数据
  };

  const onModeClick = (mode: DisplayMode) => {
    setDisplayMode(mode);
  };

  return (
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
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
        <div className={styles["chart-content"]}>
          {data &&
          data.full_load.length > 0 &&
          data.energy_saving.length > 0 ? (
            <canvas
              ref={canvasRef}
              id="prediction-chart"
              width={900}
              height={180}
            />
          ) : (
            <span>预测数据待获取</span>
          )}
        </div>
        <div className={styles["time-axis"]}>
          {data && data.labels.length > 0
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
                {data ? data.strategy.sleep_periods : "数据待获取"}
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
                    {data
                      ? data.strategy.node_distribution.running
                      : "0 个（0%）"}
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
                    {data
                      ? data.strategy.node_distribution.to_sleep
                      : "0 个（0%）"}
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
                    {data
                      ? data.strategy.node_distribution.sleeping
                      : "0 个（0%）"}
                  </span>
                </div>
              </div>
            </div>
            <div className={styles["detail-item"]}>
              <span className={styles["detail-label"]}>提前唤醒时间</span>
              <span className={styles["detail-value"]}>
                {data ? data.strategy.wake_ahead : "数据待获取"}
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
                  {data ? data.effects.saving_percent : "0%"}
                </span>
              </div>
              <div className={styles["status-item"]}>
                <span className={styles["status-label"]}>节省核时</span>
                <span className={styles["status-value"]}>
                  {data ? data.effects.saving_core_hours : "0 核时/天"}
                </span>
              </div>
              <div className={styles["status-item"]}>
                <span className={styles["status-label"]}>节省电力</span>
                <span className={styles["status-value"]}>
                  {data ? data.effects.saving_power : "~0 kWh/天"}
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
                  {data ? data.impact.delay : "数据待获取"}
                </span>
              </div>
              <div className={styles["status-item"]}>
                <span className={styles["status-label"]}>队列积压风险</span>
                <span className={styles["status-value"]}>
                  {data ? data.impact.queue_risk : "数据待获取"}
                </span>
              </div>
              <div className={styles["status-item"]}>
                <span className={styles["status-label"]}>紧急响应能力</span>
                <span className={styles["status-value"]}>
                  {data ? data.impact.emergency_response : "数据待获取"}
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
            {(["今日", "未来3天", "未来7天"] as RangeOption[]).map((option) => (
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
            ))}
          </div>
        </div>

        <div className={styles["control-group"]}>
          <span className={styles["control-label"]}>显示模式</span>
          <div className={styles["control-buttons"]}>
            {(["对比模式", "仅全开", "仅节能"] as DisplayMode[]).map((mode) => (
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

        <button type="button" className={styles["control-btn"]}>
          重新计算预测
        </button>
      </div>
    </section>
  );
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
