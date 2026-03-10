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
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    label: string;
    fullValue: number;
    saveValue: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    label: "",
    fullValue: 0,
    saveValue: 0,
  });

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

  // 处理鼠标移动事件以显示tooltip
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !data) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;

      // 计算图表区域
      const chartLeft = 50;
      const chartRight = canvas.width - 20;
      const chartWidth = chartRight - chartLeft;
      const pointsCount = data.full_load.length;
      const stepX = chartWidth / (pointsCount - 1);

      // 查找最近的数据点
      let closestIndex = -1;
      let minDistance = Infinity;

      for (let i = 0; i < pointsCount; i++) {
        const pointX = chartLeft + i * stepX;
        const distance = Math.abs(mouseX - pointX);

        if (distance < minDistance && distance < 20) {
          minDistance = distance;
          closestIndex = i;
        }
      }

      if (closestIndex >= 0) {
        setTooltip({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          label: data.labels[closestIndex] || "",
          fullValue: data.full_load[closestIndex] || 0,
          saveValue: data.energy_saving[closestIndex] || 0,
        });
      } else {
        setTooltip((prev) => ({ ...prev, visible: false }));
      }
    },
    [data]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

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
          emergency_response: resp.impact?.emergency_response ?? "数据待获取",
        },
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
                  <>
                    <canvas
                      ref={canvasRef}
                      id="prediction-chart"
                      width={900}
                      height={220}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                      style={{ cursor: "crosshair" }}
                    />
                    {tooltip.visible && (
                      <div
                        className={styles["chart-tooltip"]}
                        style={{
                          left: tooltip.x + 10,
                          top: tooltip.y - 80,
                        }}
                      >
                        <div className={styles["tooltip-time"]}>
                          {tooltip.label}
                        </div>
                        <div className={styles["tooltip-item"]}>
                          <span className={styles["tooltip-label-full"]}>
                            全开模式
                          </span>
                          <span className={styles["tooltip-value"]}>
                            {tooltip.fullValue.toFixed(1)}%
                          </span>
                        </div>
                        <div className={styles["tooltip-item"]}>
                          <span className={styles["tooltip-label-save"]}>
                            节能模式
                          </span>
                          <span className={styles["tooltip-value"]}>
                            {tooltip.saveValue.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <span>预测数据待获取</span>
                );
              })()}
          </div>
          <div
            className={styles["time-axis"]}
            // 与 canvas 中 CHART_LEFT / CHART_RIGHT_MARGIN 一致，使时间刻度与描点在 X 轴上对齐
            style={{ paddingLeft: 50, paddingRight: 20 }}
          >
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
                      {data?.strategy?.running_nodes ?? "0 个（0%）"}
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
                      {data?.strategy?.to_sleep_nodes ?? "0 个（0%）"}
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
                  <span className={styles["status-label"]}>当前平均利用率</span>
                  <span
                    className={
                      styles["status-value"] +
                      " " +
                      styles["detail-value-highlight"]
                    }
                  >
                    {data?.effects?.avg_utilization ?? "0%"}
                  </span>
                </div>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>优化后利用率</span>
                  <span className={styles["status-value"]}>
                    {data?.effects?.optimized_utilization ?? "0%"}
                  </span>
                </div>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>负载稳定性</span>
                  <span className={styles["status-value"]}>
                    {data?.effects?.load_stability ?? "数据待获取"}
                  </span>
                </div>
                <div className={styles["status-item"]}>
                  <span className={styles["status-label"]}>利用率范围</span>
                  <span className={styles["status-value"]}>
                    {data?.effects?.utilization_range ?? "0% - 0%"}
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

  // 常量：与下方时间轴的左右 padding 对齐
  const CHART_LEFT = 50;
  const CHART_RIGHT_MARGIN = 20;

  // 清除画布
  ctx.clearRect(0, 0, width, height);

  // 设置渲染质量
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 绘制纯白背景（办公风格）
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 计算绘图区域
  const chartLeft = CHART_LEFT;
  const chartRight = width - CHART_RIGHT_MARGIN;
  const chartTop = 20;
  const chartBottom = height - 20;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  // 根据数据动态计算 Y 轴范围，使曲线更“有起伏”
  const allValues = [...fullLoadData, ...energySavingData].filter(
    (v) => Number.isFinite(v),
  );
  let minValue = 0;
  let maxValue = 100;
  if (allValues.length > 0) {
    minValue = Math.min(...allValues);
    maxValue = Math.max(...allValues);

    if (maxValue === minValue) {
      // 所有点几乎相等，给一个固定窗口避免画成一条直线
      const center = maxValue;
      minValue = Math.max(0, center - 10);
      maxValue = center + 10;
    } else {
      // 在上下各扩 10% 的可视区，避免贴边
      const padding = (maxValue - minValue) * 0.1;
      minValue = Math.max(0, minValue - padding);
      maxValue = maxValue + padding;
    }
  }

  const valueRange = maxValue - minValue || 1;
  const scaleY = chartHeight / valueRange;
  const pointsCount = fullLoadData.length;
  const stepX = chartWidth / (pointsCount - 1);

  // 绘制网格和刻度（办公风格：细线、浅灰色），刻度随数据动态变化
  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 1;
  ctx.font = "11px 'Segoe UI', 'Microsoft YaHei', sans-serif";

  // 水平网格线（6条）
  const gridLines = 5;
  const stepValue = valueRange / gridLines;
  for (let i = 0; i <= gridLines; i += 1) {
    const t = i / gridLines;
    const y = chartTop + t * chartHeight;
    const value = maxValue - i * stepValue;

    // 绘制网格线
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();

    // 绘制Y轴刻度
    ctx.fillStyle = "#666666";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${value.toFixed(1)}%`, chartLeft - 8, y);
  }

  // 绘制垂直参考线（与数据点对齐）
  ctx.strokeStyle = "#f5f5f5";
  for (let i = 0; i < pointsCount; i++) {
    if (i % 4 === 0) {
      const x = chartLeft + i * stepX;
      ctx.beginPath();
      ctx.moveTo(x, chartTop);
      ctx.lineTo(x, chartBottom);
      ctx.stroke();
    }
  }

  // 绘制坐标轴（办公风格：深灰色、较粗）
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 1.5;
  
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

  // 绘制数据线的函数（办公风格：直线连接、无阴影）
  const drawDataLine = (data: number[], color: string, _label: string) => {
    if (data.length === 0) return;

    // 绘制填充区域（办公风格：淡色填充）
    const fillGradient = ctx.createLinearGradient(0, chartTop, 0, chartBottom);
    fillGradient.addColorStop(0, `${color}15`);
    fillGradient.addColorStop(1, `${color}05`);
    
    ctx.fillStyle = fillGradient;
    ctx.beginPath();
    ctx.moveTo(chartLeft, chartBottom);
    
    data.forEach((value, index) => {
      const x = chartLeft + index * stepX;
      const y = chartBottom - (value - minValue) * scaleY;
      ctx.lineTo(x, y);
    });
    
    ctx.lineTo(chartLeft + (data.length - 1) * stepX, chartBottom);
    ctx.closePath();
    ctx.fill();

    // 绘制主线条（办公风格：实线、无阴影）
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    data.forEach((value, index) => {
      const x = chartLeft + index * stepX;
      const y = chartBottom - (value - minValue) * scaleY;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // 绘制数据点（办公风格：小圆点）
    data.forEach((value, index) => {
      const x = chartLeft + index * stepX;
      const y = chartBottom - (value - minValue) * scaleY;

      // 白色边框
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // 颜色填充
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 绘制最高点和最低点标注（办公风格：简洁标注）
    const maxVal = Math.max(...data);
    const minVal = Math.min(...data);
    const maxIdx = data.indexOf(maxVal);
    const minIdx = data.indexOf(minVal);

    // 标注最高点
    if (maxIdx >= 0) {
      const x = chartLeft + maxIdx * stepX;
      const y = chartBottom - (maxVal - minValue) * scaleY;
      
      // 绘制标注背景
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      const text = `${maxVal.toFixed(1)}%`;
      ctx.font = "bold 10px 'Segoe UI', 'Microsoft YaHei', sans-serif";
      const metrics = ctx.measureText(text);
      const padding = 4;
      const boxWidth = metrics.width + padding * 2;
      const boxHeight = 16;
      const boxX = x - boxWidth / 2;
      const boxY = y - boxHeight - 8;
      
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
      
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x, boxY + boxHeight / 2);
    }

    // 标注最低点
    if (minIdx >= 0 && minIdx !== maxIdx) {
      const x = chartLeft + minIdx * stepX;
      const y = chartBottom - (minVal - minValue) * scaleY;
      
      // 绘制标注背景
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      const text = `${minVal.toFixed(1)}%`;
      ctx.font = "bold 10px 'Segoe UI', 'Microsoft YaHei', sans-serif";
      const metrics = ctx.measureText(text);
      const padding = 4;
      const boxWidth = metrics.width + padding * 2;
      const boxHeight = 16;
      const boxX = x - boxWidth / 2;
      const boxY = y + 8;
      
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
      
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x, boxY + boxHeight / 2);
    }
  };

  // 根据显示模式绘制曲线
  if (displayMode === "对比模式" || displayMode === "仅全开") {
    drawDataLine(fullLoadData, "#10b981", "全开模式");
  }

  if (displayMode === "对比模式" || displayMode === "仅节能") {
    drawDataLine(energySavingData, "#3b82f6", "节能模式");
  }
}

export default PredictionChart;
