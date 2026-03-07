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
      
      // 检查返回的数据是否有效
      if (!resp.labels || resp.labels.length === 0) {
        setError("该日期暂无预测数据，请确保已上传足够的历史数据");
        setData(null);
        return;
      }
      
      setData({
        labels: resp.labels ?? [],
        full_load: resp.utilization ?? [],
        energy_saving: resp.energy_saving ?? [],
        strategy: resp.strategy,
        effects: resp.effects,
        impact: resp.impact,
      });
    } catch (err: any) {
      console.error(err);
      
      // 更详细的错误提示
      if (err.response?.status === 400) {
        setError("历史数据不足或日期格式错误，请检查上传的数据");
      } else if (err.response?.status === 503) {
        setError("预测服务暂时不可用，请稍后重试");
      } else if (err.response?.status === 401) {
        setError("登录已过期，请重新登录");
      } else {
        setError("获取预测失败，请稍后重试");
      }
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
                    height={220}
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

  // 清除画布
  ctx.clearRect(0, 0, width, height);

  // 设置更好的渲染质量
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 绘制背景渐变
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
  bgGradient.addColorStop(0, '#f8fafc');
  bgGradient.addColorStop(1, '#ffffff');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // 绘制网格和刻度
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.font = "12px 'Segoe UI', sans-serif";

  // 水平网格线（6条）
  for (let i = 0; i <= 5; i += 1) {
    const y = 20 + i * 32;
    
    // 绘制网格线
    ctx.beginPath();
    ctx.moveTo(50, y);
    ctx.lineTo(width - 20, y);
    ctx.stroke();

    // 绘制Y轴刻度
    const value = (5 - i) * 20;
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${value}%`, 42, y);
  }

  // 绘制垂直参考线（每4小时一条）
  ctx.strokeStyle = "#f3f4f6";
  for (let i = 0; i <= 24; i += 4) {
    const x = 50 + (i / 24) * (width - 70);
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x, height - 20);
    ctx.stroke();
  }

  // 计算绘图区域
  const chartLeft = 50;
  const chartRight = width - 20;
  const chartTop = 20;
  const chartBottom = height - 20;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  const maxValue = 100;
  const scaleY = chartHeight / maxValue;
  const pointsCount = fullLoadData.length;
  const stepX = chartWidth / Math.max(pointsCount - 1, 1);

  // 绘制数据线的函数
  const drawDataLine = (data: number[], color: string, label: string) => {
    if (data.length === 0) return;

    // 绘制填充区域
    const fillGradient = ctx.createLinearGradient(0, chartTop, 0, chartBottom);
    fillGradient.addColorStop(0, `${color}30`);
    fillGradient.addColorStop(1, `${color}08`);
    
    ctx.fillStyle = fillGradient;
    ctx.beginPath();
    ctx.moveTo(chartLeft, chartBottom);
    
    data.forEach((value, index) => {
      const x = chartLeft + index * stepX;
      const y = chartBottom - value * scaleY;
      ctx.lineTo(x, y);
    });
    
    ctx.lineTo(chartLeft + (data.length - 1) * stepX, chartBottom);
    ctx.closePath();
    ctx.fill();

    // 绘制主线条（更粗、更平滑）
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = `${color}40`;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    
    ctx.beginPath();
    data.forEach((value, index) => {
      const x = chartLeft + index * stepX;
      const y = chartBottom - value * scaleY;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // 重置阴影
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 绘制数据点（更大、更明显）
    data.forEach((value, index) => {
      const x = chartLeft + index * stepX;
      const y = chartBottom - value * scaleY;

      // 外圈（白色边框）
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();

      // 内圈（颜色填充）
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 绘制最高点和最低点标注
    const maxVal = Math.max(...data);
    const minVal = Math.min(...data);
    const maxIdx = data.indexOf(maxVal);
    const minIdx = data.indexOf(minVal);

    // 标注最高点
    if (maxIdx >= 0) {
      const x = chartLeft + maxIdx * stepX;
      const y = chartBottom - maxVal * scaleY;
      
      ctx.fillStyle = color;
      ctx.font = "bold 11px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${maxVal.toFixed(1)}%`, x, y - 10);
    }

    // 标注最低点
    if (minIdx >= 0 && minIdx !== maxIdx) {
      const x = chartLeft + minIdx * stepX;
      const y = chartBottom - minVal * scaleY;
      
      ctx.fillStyle = color;
      ctx.font = "bold 11px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`${minVal.toFixed(1)}%`, x, y + 10);
    }
  };

  // 根据显示模式绘制曲线
  if (displayMode === "对比模式" || displayMode === "仅全开") {
    drawDataLine(fullLoadData, "#10b981", "全开模式");
  }

  if (displayMode === "对比模式" || displayMode === "仅节能") {
    drawDataLine(energySavingData, "#3b82f6", "节能模式");
  }

  // 绘制坐标轴
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 2;
  
  // Y轴
  ctx.beginPath();
  ctx.moveTo(chartLeft, chartTop);
  ctx.lineTo(chartLeft, chartBottom);
  ctx.stroke();
  
  // X轴
  ctx.beginPath();
  ctx.moveTo(chartLeft, chartBottom);
  ctx.lineTo(chartRight, chartBottom);
  ctx.stroke();
}

export default PredictionChart;
