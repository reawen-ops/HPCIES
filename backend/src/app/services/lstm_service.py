"""Service for interacting with LSTM prediction API."""

from __future__ import annotations

import email.utils
from typing import List, Dict, Any
import requests
from datetime import datetime, timedelta

from app.core.config import settings


class LSTMPredictionError(Exception):
    """Exception raised when LSTM API call fails."""

    pass


def predict_24h_load(
    history_24h: List[float], last_timestamp: str, predict_hours: int = 24
) -> List[Dict[str, Any]]:
    """
    调用 LSTM API 预测未来负载。

    参数:
        history_24h: 前 24 小时的 CPU 核时使用量列表
        last_timestamp: 最后时间戳，格式为 "YYYY-MM-DD HH:MM:SS"
        predict_hours: 预测小时数，默认 24

    返回:
        预测结果列表，每个元素包含:
        - timestamp: 预测时间点（可选）
        - predicted_load: 预测负载
        - suggested_nodes: 建议节点数（可选）

    异常:
        LSTMPredictionError: API 调用失败时抛出
    """
    if len(history_24h) != 24:
        raise ValueError(f"history_24h 必须包含 24 个数据点，当前为 {len(history_24h)}")

    payload = {
        "history_24h": history_24h,
        "last_timestamp": last_timestamp,
        "predict_hours": predict_hours,
    }

    headers = {
        "Content-Type": "application/json",
        "Date": email.utils.formatdate(usegmt=True),
    }

    try:
        response = requests.post(
            settings.lstm_api_url,
            json=payload,
            headers=headers,
            timeout=30,  # 30 秒超时
        )

        if response.status_code != 200:
            raise LSTMPredictionError(
                f"LSTM API 返回错误状态码: {response.status_code}, 响应: {response.text}"
            )

        data = response.json()

        # 解析返回的预测结果
        predictions = data.get("predictions", [])
        if not predictions:
            raise LSTMPredictionError("LSTM API 返回空预测结果")

        # 验证并标准化预测结果格式
        standardized_predictions = []
        for i, pred in enumerate(predictions):
            if isinstance(pred, dict):
                # 字典格式，提取字段
                standardized_pred = {
                    "predicted_load": pred.get("predicted_load") or pred.get("load") or pred.get("value", 0),
                    "suggested_nodes": pred.get("suggested_nodes") or pred.get("nodes", 1),
                }
                # 如果有 timestamp 字段，保留它
                if "timestamp" in pred:
                    standardized_pred["timestamp"] = pred["timestamp"]
            elif isinstance(pred, (int, float)):
                # 简单数值格式
                standardized_pred = {
                    "predicted_load": float(pred),
                    "suggested_nodes": 1,
                }
            else:
                raise LSTMPredictionError(f"不支持的预测结果格式: {type(pred)}")
            
            standardized_predictions.append(standardized_pred)

        return standardized_predictions

    except requests.exceptions.Timeout:
        raise LSTMPredictionError("LSTM API 请求超时")
    except requests.exceptions.ConnectionError:
        raise LSTMPredictionError("无法连接到 LSTM API")
    except requests.exceptions.RequestException as e:
        raise LSTMPredictionError(f"LSTM API 请求失败: {str(e)}")
    except (KeyError, ValueError, TypeError) as e:
        raise LSTMPredictionError(f"LSTM API 响应格式错误: {str(e)}")


def calculate_energy_saving_curve(
    predicted_loads: List[float], total_nodes: int, core_per_node: int
) -> List[float]:
    """
    根据预测负载计算节能模式下的利用率曲线。

    参数:
        predicted_loads: 预测的负载列表
        total_nodes: 总节点数
        core_per_node: 每节点核心数

    返回:
        节能模式下的利用率列表（百分比）
    """
    if total_nodes <= 0 or core_per_node <= 0:
        return [0.0] * len(predicted_loads)

    total_cores = total_nodes * core_per_node
    energy_saving = []

    for load in predicted_loads:
        # 根据负载动态调整节点数
        # 策略：保持 50% 节点运行，16% 待休眠，34% 休眠
        active_ratio = 0.5  # 50% 节点保持运行
        active_cores = total_cores * active_ratio

        if active_cores > 0:
            utilization = (load / active_cores) * 100
            # 限制在 0-100% 范围内
            utilization = max(0.0, min(100.0, utilization))
        else:
            utilization = 0.0

        energy_saving.append(utilization)

    return energy_saving


def generate_strategy_info(
    predicted_loads: List[float], total_nodes: int
) -> Dict[str, Any]:
    """
    根据预测负载生成节能策略信息。

    参数:
        predicted_loads: 预测的负载列表
        total_nodes: 总节点数

    返回:
        策略信息字典
    """
    # 找出低负载时段（用于建议休眠）
    avg_load = sum(predicted_loads) / len(predicted_loads) if predicted_loads else 0
    low_load_hours = [
        i for i, load in enumerate(predicted_loads) if load < avg_load * 0.6
    ]

    # 生成休眠时段建议
    sleep_periods = []
    if low_load_hours:
        start = low_load_hours[0]
        end = low_load_hours[0]
        for hour in low_load_hours[1:]:
            if hour == end + 1:
                end = hour
            else:
                sleep_periods.append(f"{start:02d}:00-{end+1:02d}:00")
                start = hour
                end = hour
        sleep_periods.append(f"{start:02d}:00-{end+1:02d}:00")

    sleep_periods_str = ", ".join(sleep_periods) if sleep_periods else "无明显低负载时段"

    # 节点分布
    running_nodes = int(total_nodes * 0.5)
    to_sleep_nodes = int(total_nodes * 0.16)
    sleeping_nodes = total_nodes - running_nodes - to_sleep_nodes

    return {
        "sleep_periods": sleep_periods_str,
        "node_distribution": {
            "running": f"{running_nodes} 个 (50%)",
            "to_sleep": f"{to_sleep_nodes} 个 (16%)",
            "sleeping": f"{sleeping_nodes} 个 (34%)",
        },
        "wake_ahead": "提前 15 分钟唤醒",
    }


def calculate_effects(
    predicted_loads: List[float], total_nodes: int, core_per_node: int
) -> Dict[str, str]:
    """
    计算节能效果。

    参数:
        predicted_loads: 预测的负载列表
        total_nodes: 总节点数
        core_per_node: 每节点核心数

    返回:
        效果信息字典
    """
    if not predicted_loads or total_nodes <= 0 or core_per_node <= 0:
        return {
            "saving_percent": "0%",
            "saving_core_hours": "0 核时/天",
            "saving_power": "~0 kWh/天",
        }

    total_cores = total_nodes * core_per_node

    # 全开模式：所有核心全天运行
    full_load_core_hours = total_cores * 24

    # 节能模式：50% 节点运行
    energy_saving_core_hours = total_cores * 0.5 * 24

    # 节省的核时
    saved_core_hours = full_load_core_hours - energy_saving_core_hours

    # 节能百分比
    saving_percent = (saved_core_hours / full_load_core_hours) * 100

    # 假设每核心每小时耗电 0.1 kWh
    saved_power = saved_core_hours * 0.1

    return {
        "saving_percent": f"{saving_percent:.1f}%",
        "saving_core_hours": f"{saved_core_hours:.0f} 核时/天",
        "saving_power": f"~{saved_power:.1f} kWh/天",
    }


def calculate_impact(predicted_loads: List[float]) -> Dict[str, str]:
    """
    计算任务影响。

    参数:
        predicted_loads: 预测的负载列表

    返回:
        影响信息字典
    """
    if not predicted_loads:
        return {
            "delay": "无数据",
            "queue_risk": "无数据",
            "emergency_response": "无数据",
        }

    avg_load = sum(predicted_loads) / len(predicted_loads)
    max_load = max(predicted_loads)

    # 根据负载情况评估影响
    if max_load < 50:
        delay = "< 5 分钟"
        queue_risk = "低"
        emergency = "优秀"
    elif max_load < 80:
        delay = "5-15 分钟"
        queue_risk = "中"
        emergency = "良好"
    else:
        delay = "> 15 分钟"
        queue_risk = "高"
        emergency = "一般"

    return {
        "delay": delay,
        "queue_risk": queue_risk,
        "emergency_response": emergency,
    }
