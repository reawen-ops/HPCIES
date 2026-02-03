import { useEffect, useRef, useState } from "react";
import { FaBolt, FaChartLine, FaLeaf, FaTasks } from "react-icons/fa";
import styles from "./PredictionChart.module.scss";

type RangeOption = "今日" | "未来3天" | "未来7天";
type DisplayMode = "对比模式" | "仅全开" | "仅节能";

const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

const fullLoadData = [
  15, 12, 10, 8, 6, 8, 15, 28, 42, 56, 68, 72, 75, 70, 65, 58, 52, 48, 55, 62,
  58, 45, 32, 20,
];

const energySavingData = [
  15, 10, 5, 3, 2, 4, 12, 25, 38, 50, 60, 65, 68, 62, 55, 45, 40, 38, 45, 55,
  50, 38, 25, 15,
];

const PredictionChart = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [range, setRange] = useState<RangeOption>("今日");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("对比模式");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawChart(ctx, displayMode);
  }, [displayMode, range]);

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
            今日核使用率预测曲线
          </h3>
          <div className={styles["chart-legend"]}>
            <div className={styles["legend-item"]}>
              <span
                className={styles["legend-color"] + " " + styles["color-open"]}
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
        </div>
        <div className={styles["chart-content"]}>
          <canvas
            ref={canvasRef}
            id="prediction-chart"
            width={900}
            height={180}
          />
        </div>
        <div className={styles["time-axis"]}>
          <span>0:00</span>
          <span>4:00</span>
          <span>8:00</span>
          <span>12:00</span>
          <span>16:00</span>
          <span>20:00</span>
          <span>24:00</span>
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
                02:00-06:00, 14:00-16:00
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
                  <span className={styles["status-value"]}>64 个（50%）</span>
                </div>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>
                    <span
                      className={`${styles["status-dot"]} ${styles["status-dot-to-sleep"]}`}
                    />
                    待休眠
                  </span>
                  <span className={styles["status-value"]}>20 个（16%）</span>
                </div>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>
                    <span
                      className={`${styles["status-dot"]} ${styles["status-dot-sleeping"]}`}
                    />
                    休眠
                  </span>
                  <span className={styles["status-value"]}>44 个（34%）</span>
                </div>
              </div>
            </div>
            <div className={styles["detail-item"]}>
              <span className={styles["detail-label"]}>提前唤醒时间</span>
              <span className={styles["detail-value"]}>高峰前30分钟</span>
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
                  24.5%
                </span>
              </div>
              <div className={styles["status-item"]}>
                <span className={styles["status-label"]}>节省核时</span>
                <span className={styles["status-value"]}>1,248 核时/天</span>
              </div>
              <div className={styles["status-item"]}>
                <span className={styles["status-label"]}>节省电力</span>
                <span className={styles["status-value"]}>~312 kWh/天</span>
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
                <span className={styles["status-value"]}>≤ 15分钟</span>
              </div>
              <div className={styles["status-item"]}>
                <span className={styles["status-label"]}>队列积压风险</span>
                <span className={styles["status-value"]}>低</span>
              </div>
              <div className={styles["status-item"]}>
                <span className={styles["status-label"]}>紧急响应能力</span>
                <span className={styles["status-value"]}>
                  30分钟内恢复全部节点
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

function drawChart(ctx: CanvasRenderingContext2D, displayMode: DisplayMode) {
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
  const stepX = (width - 60) / (labels.length - 1);

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
