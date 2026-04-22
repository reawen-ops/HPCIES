""" DeepSeek AI 服务集成模块 """

from __future__ import annotations

import requests
from typing import List, Dict, Optional, Any

from app.core.config import settings


class DeepSeekError(Exception):
    """ DeepSeek API 调用异常 """
    pass


def get_deepseek_api_key() -> str:
    """
    从环境变量获取DeepSeek API密钥。
    
    返回值:
        API 密钥字符串
        
    抛出异常:
        DeepSeekError: 如果未配置 API 密钥
    """
    # 通过 pydantic-settings从.env/环境变量读取
    api_key = settings.deepseek_api_key
    if not api_key:
        raise DeepSeekError("未配置 DEEPSEEK_API_KEY 环境变量")
    return api_key


def chat_with_deepseek(
    messages: List[Dict[str, str]],
    system_prompt: Optional[str] = None,
    model: str = "deepseek-chat",
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> str:
    """
    调用DeepSeek API进行对话。
    
    参数:
        messages: 对话历史，格式为 [{"role": "user", "content": "..."}, ...]
        system_prompt: 系统提示词（可选）
        model: 模型名称，默认为 "deepseek-chat"
        temperature: 温度参数，控制随机性（0-2）
        max_tokens: 最大生成token数
        
    返回值:
        AI回复的文本内容
        
    抛出异常:
        DeepSeekError: API调用失败时抛出
    """
    try:
        api_key = get_deepseek_api_key()
    except DeepSeekError:
        # 如果没有配置 API 密钥，返回友好提示
        return "抱歉，AI 助手暂未配置。请联系管理员配置DEEPSEEK_API_KEY环境变量。"
    
    # 构建请求消息列表
    api_messages = []
    
    # 添加系统提示词
    if system_prompt:
        api_messages.append({"role": "system", "content": system_prompt})
    
    # 添加对话历史
    api_messages.extend(messages)
    
    # 准备请求
    base_url = settings.deepseek_base_url.rstrip("/")
    url = f"{base_url}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    payload = {
        "model": model,
        "messages": api_messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        
        # 提取AI回复
        if "choices" in result and len(result["choices"]) > 0:
            return result["choices"][0]["message"]["content"]
        else:
            raise DeepSeekError("API 返回格式异常：缺少 choices 字段")
            
    except requests.exceptions.Timeout:
        raise DeepSeekError("API 请求超时，请稍后重试")
    except requests.exceptions.RequestException as e:
        raise DeepSeekError(f"API 请求失败: {str(e)}")
    except (KeyError, IndexError) as e:
        raise DeepSeekError(f"解析 API 响应失败: {str(e)}")


def get_hpc_system_prompt() -> str:
    """
    获取 HPC 能源管家系统的专用提示词。

    Returns:
        系统提示词字符串
    """
    return """你是“HPC 能源管家”系统内置的 AI 助手，运行在一个已经集成了用户真实数据的 Web 系统中。

系统会通过对话历史、系统消息等方式，向你提供：
- 集群配置（总节点数、每节点核心数等）
- 某一天 24 小时的预测负载、利用率、节能曲线等关键信息
- 以及用户在界面上看到的各种统计结果的摘要

你的职责包括：
1. 解答用户关于 HPC 集群能源管理的问题
2. 分析“已经提供给你”的预测和统计数据，给出节能优化建议
3. 解释系统图表和预测结果的含义
4. 帮助用户理解当前集群运行状况和可能的风险
5. 提供与本系统场景密切相关的 HPC 调度和资源管理建议

回答时请严格遵守以下要求：
- **所有回答必须使用 Markdown 格式输出**（包含标题、列表、表格、代码块等均可），以便前端按 Markdown 渲染展示
- **不要输出 HTML**（例如 <div>...</div>），避免前端渲染与安全问题
- **始终假设自己已经拿到了系统提供的数据，不要要求用户再去运行命令或查询监控系统获取同样的数据**
- **除非用户明确要求，否则不要给出 Slurm/PBS/LSF 等命令行示例或长篇工具列表**
- 使用专业但易懂的中文，尽量围绕“当前对话中提供的真实数据”展开分析
- 先直接给出结论和针对当前场景的建议，必要时再简要解释原因
- 回答长度适中，避免过度模板化的长篇大论（通常控制在 3~8 句话，如用户特别要求可适当展开）
- 如果确实缺少关键数据，请直接说明“在当前系统中无法看到某某数据”，而不是让用户去执行外部命令

请用中文回答所有问题。"""


def format_chat_history_for_api(
    chat_messages: List[Dict],
    max_history: int = 10,
) -> List[Dict[str, str]]:
    """
    将数据库中的聊天历史格式化为DeepSeek API所需的格式。
    
    参数:
        chat_messages: 数据库中的聊天消息列表
        max_history: 最多保留的历史消息数（默认10条，即5轮对话）
        
    返回值:
        格式化后的消息列表
    """
    # 只保留最近的N条消息
    recent_messages = chat_messages[-max_history:] if len(chat_messages) > max_history else chat_messages
    
    # 转换格式
    api_messages = []
    for msg in recent_messages:
        role = "user" if msg["author"] == "user" else "assistant"
        api_messages.append({
            "role": role,
            "content": msg["text"]
        })
    
    return api_messages



def analyze_prediction_data(
    date: str,
    predicted_loads: List[float],
    utilization: List[float],
    total_nodes: int,
    core_per_node: int,
) -> Dict[str, Any]:
    """
    使用DeepSeek AI分析预测数据，生成节能策略、效果评估和任务影响分析。
    
    参数:
        date: 预测日期
        predicted_loads: 24小时预测负载列表
        utilization: 24小时利用率列表
        total_nodes: 总节点数
        core_per_node: 每节点核心数
        
    返回值:
        包含 strategy, effects, impact 的字典
    """
    # 计算一些基础统计数据
    avg_load = sum(predicted_loads) / len(predicted_loads) if predicted_loads else 0
    max_load = max(predicted_loads) if predicted_loads else 0
    min_load = min(predicted_loads) if predicted_loads else 0
    avg_util = sum(utilization) / len(utilization) if utilization else 0
    required_peak_nodes = max(1, int((max_load + core_per_node - 1) // core_per_node)) if core_per_node > 0 else 1
    
    # 找出低负载时段（利用率 < 40%）
    low_load_hours = [i for i, util in enumerate(utilization) if util < 40]
    
    # 找出高负载时段（利用率 > 70%）
    high_load_hours = [i for i, util in enumerate(utilization) if util > 70]
    
    # 构建分析提示词
    analysis_prompt = f"""请作为 HPC 能源管理专家，分析以下预测数据并提供专业建议：

**集群配置**：
- 总节点数：{total_nodes} 个
- 每节点核心数：{core_per_node} 核
- 总计算能力：{total_nodes * core_per_node} 核

**预测日期**：{date}

**负载统计**：
- 平均负载：{avg_load:.1f} 核
- 最高负载：{max_load:.1f} 核
- 最低负载：{min_load:.1f} 核
- 平均利用率：{avg_util:.1f}%，即假设所有节点都处于开机状态，每小时的核使用率 = 每小时的核使用量 / (总计算能力 * 1小时)，平均利用率 = 24小时的核使用量 / 24

**负载分布**：
- 低负载时段（<40%）：{len(low_load_hours)} 小时，具体时段：{', '.join([f'{h:02d}:00' for h in low_load_hours]) if low_load_hours else '无'}
- 高负载时段（>70%）：{len(high_load_hours)} 小时，具体时段：{', '.join([f'{h:02d}:00' for h in high_load_hours]) if high_load_hours else '无'}

**24小时详细数据**：
{chr(10).join([f"  {i:02d}:00 - 负载: {predicted_loads[i]:.1f}核, 利用率: {utilization[i]:.1f}%" for i in range(len(predicted_loads))])}

请提供以下分析（使用简洁专业的语言）：

1. **节能策略**（strategy）：
   - sleep_periods: 建议休眠时段，必须基于上述低负载时段（利用率<40%），选择连续2小时以上的时段。格式：HH:00-HH:00, HH:00-HH:00。如果没有合适的低负载时段，返回"无明显低负载时段"，示例：24小时的预测数据中
   - running_nodes: 建议保持运行的节点数（格式：X 个 (Y%)）
   - to_sleep_nodes: 建议待休眠的节点数（格式：X 个 (Y%)）
   - sleeping_nodes: 建议休眠/关闭的节点数（格式：X 个 (Y%)）
   **硬性约束**：
     - running_nodes + to_sleep_nodes + sleeping_nodes 的“X”之和必须等于总节点数 {total_nodes}
     - 三个百分比 Y% 之和必须等于 100%
     - to_sleep_nodes 的比例必须 **>= 5%**（即：to_sleep_nodes 的 X 必须 >= ceil({total_nodes} * 0.05)）
     - running_nodes 的 X 必须 **>= {required_peak_nodes}**（该值来自峰值负载约束：ceil({max_load:.1f} / {core_per_node})）
     - 不允许给出激进到不可执行的策略，保证高峰小时不出现明显算力缺口

2. **负载特征**（effects）：
   - 功率口径：单节点运行功率 20KWh/24h，单节点待机态功率 8KWh/24h
   - avg_utilization: 当前平均利用率（如：{avg_util:.1f}%）
   - optimized_utilization: 节能模式下的预期利用率（关闭部分节点后），即假设用户严格按照你所提议的节点策略配置，每小时核使用率 = 每小时的核使用量 / （开机节点数 * 每个节点的核数 * 1小时），平均利用率 = 24小时的核使用量 / 24
   - load_stability: 负载稳定性（稳定/波动较大）
   - peak_utilization: 峰值利用率
   - min_utilization: 最低利用率
   - utilization_range: 利用率范围（如：20.5% - 85.3%）
   - suggested_daily_energy: 建议策略日耗电量估算（如：4320.0 kWh）
   - actual_daily_energy: 实际日耗电估算量（如：7680.0 kWh）
   - saving_efficiency: 节能效率（如：43.75%）

3. **任务影响**（impact）：
   - delay: 预计任务延迟（如：<5%，可接受）
   - queue_risk: 队列积压风险（如：低风险）
   - immediate_capacity: 可立即启动容量（展示待机节点，格式如：8 个节点可立即启动）
   - emergency_response: 紧急响应能力（如：保留30%节点，可快速唤醒）

请直接返回JSON格式的结果，不要包含任何解释文字：
{{
  "strategy": {{
    "sleep_periods": "...",
    "running_nodes": "X 个 (Y%)",
    "to_sleep_nodes": "X 个 (Y%)",
    "sleeping_nodes": "X 个 (Y%)"
  }},
  "effects": {{
    "avg_utilization": "X.X%",
    "optimized_utilization": "X.X%",
    "load_stability": "稳定/波动较大",
    "peak_utilization": "X.X%",
    "min_utilization": "X.X%",
    "utilization_range": "X.X% - X.X%",
    "suggested_daily_energy": "X.X kWh",
    "actual_daily_energy": "X.X kWh",
    "saving_efficiency": "X.X%"
  }},
  "impact": {{
    "delay": "...",
    "queue_risk": "...",
    "immediate_capacity": "...",
    "emergency_response": "..."
  }}
}}"""

    try:
        # 调用 DeepSeek API
        response = chat_with_deepseek(
            messages=[{"role": "user", "content": analysis_prompt}],
            system_prompt="你是一位 HPC 能源管理专家，擅长分析负载数据并提供节能优化建议。请始终返回有效的JSON格式数据。",
            temperature=0.3,  # 较低温度以获得更确定性的结果
            max_tokens=1500,
        )
        
        # 解析JSON响应
        import json
        import re
        
        # 提取JSON部分
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            result = json.loads(json_match.group())
            
            # 验证必需字段
            if "strategy" in result and "effects" in result and "impact" in result:
                return result
        
        # 如果解析失败，返回基于规则的默认值
        raise ValueError("AI 返回格式不正确")
        
    except Exception as e:
        # 降级策略：使用基于规则的分析
        print(f"AI 分析失败，使用规则引擎: {str(e)}")
        return generate_rule_based_analysis(
            predicted_loads, utilization, total_nodes, core_per_node
        )


def generate_rule_based_analysis(
    predicted_loads: List[float],
    utilization: List[float],
    total_nodes: int,
    core_per_node: int,
) -> Dict[str, Any]:
    """
    基于规则的分析（作为AI分析的降级方案）。
    
    参数:
        predicted_loads: 24小时预测负载列表
        utilization: 24小时利用率列表
        total_nodes: 总节点数
        core_per_node: 每节点核心数
        
    返回值:
        包含 strategy, effects, impact 的字典
    """
    # 找出低负载时段（利用率 < 40%），并合并连续时段
    low_load_periods = []
    start_hour = None
    
    for i, util in enumerate(utilization):
        if util < 40:
            if start_hour is None:
                start_hour = i
        else:
            if start_hour is not None:
                if i - start_hour >= 2:  # 至少连续2小时
                    low_load_periods.append(f"{start_hour:02d}:00-{i:02d}:00")
                start_hour = None
    
    # 处理跨越午夜的情况
    if start_hour is not None and len(utilization) - start_hour >= 2:
        low_load_periods.append(f"{start_hour:02d}:00-24:00")
    
    sleep_periods = ", ".join(low_load_periods) if low_load_periods else "无明显低负载时段"
    
    # 计算平均利用率
    avg_util = sum(utilization) / len(utilization) if utilization else 0
    
    # 计算实际的负载统计
    total_cores = total_nodes * core_per_node
    avg_load = sum(predicted_loads) / len(predicted_loads) if predicted_loads else 0
    max_load = max(predicted_loads) if predicted_loads else 0
    min_load = min(predicted_loads) if predicted_loads else 0

    # 节点建议：先满足峰值负载，再给少量冗余，避免建议过于激进
    required_peak_nodes = max(1, int((max_load + core_per_node - 1) // core_per_node)) if core_per_node > 0 else 1
    avg_required_nodes = max(1, int((avg_load + core_per_node - 1) // core_per_node)) if core_per_node > 0 else 1
    reserve_nodes = max(1, int(total_nodes * 0.05))
    running_nodes = min(total_nodes, max(required_peak_nodes, avg_required_nodes + reserve_nodes))

    min_to_sleep_nodes = max(1, int((total_nodes * 0.05) + 0.9999))
    preferred_to_sleep = max(min_to_sleep_nodes, int(total_nodes * 0.15))
    to_sleep_nodes = min(total_nodes - running_nodes, preferred_to_sleep)
    if to_sleep_nodes < min_to_sleep_nodes:
        # 兜底：当资源紧张时优先满足峰值运行，待机节点至少为0
        to_sleep_nodes = max(0, min(total_nodes - running_nodes, min_to_sleep_nodes))

    sleeping_nodes = max(0, total_nodes - running_nodes - to_sleep_nodes)
    if running_nodes + to_sleep_nodes + sleeping_nodes != total_nodes:
        sleeping_nodes = max(0, total_nodes - running_nodes - to_sleep_nodes)

    running_pct = (running_nodes / total_nodes * 100) if total_nodes > 0 else 0
    to_sleep_pct = (to_sleep_nodes / total_nodes * 100) if total_nodes > 0 else 0
    sleeping_pct = max(0.0, 100.0 - running_pct - to_sleep_pct)
    
    # 计算负载波动
    load_variance = max_load - min_load
    load_stability = "稳定" if load_variance < avg_load * 0.3 else "波动较大"
    
    # 计算峰值利用率
    max_util = max(utilization) if utilization else 0
    min_util = min(utilization) if utilization else 0
    
    # 计算建议的节能模式下的平均利用率
    # 假设关闭部分节点后，负载分配到运行节点上
    active_cores = running_nodes * core_per_node
    optimized_util = (avg_load / active_cores * 100) if active_cores > 0 else 0
    optimized_util = min(100.0, optimized_util)  # 不超过100%

    # 按前端展示口径估算日耗电
    running_power = 20
    standby_power = 8
    actual_daily_energy = 0.0
    for load in predicted_loads:
        running_hour_nodes = min(total_nodes, max(0, int((load + core_per_node - 1) // core_per_node)))
        standby_hour_nodes = max(0, total_nodes - running_hour_nodes)
        actual_daily_energy += running_hour_nodes * running_power + standby_hour_nodes * standby_power
    suggested_daily_energy = running_nodes * running_power * 24 + to_sleep_nodes * standby_power * 24
    saving_efficiency = (
        ((actual_daily_energy - suggested_daily_energy) / actual_daily_energy) * 100
        if actual_daily_energy > 0
        else 0
    )
    
    # 评估任务影响
    if avg_util < 50:
        delay = "<3%，几乎无影响"
        queue_risk = "极低风险"
    elif avg_util < 70:
        delay = "<5%，可接受"
        queue_risk = "低风险"
    else:
        delay = "<10%，需监控"
        queue_risk = "中等风险，建议密切关注"
    
    emergency_response = f"保留 {running_nodes} 个节点运行，{to_sleep_nodes} 个节点可在 30 秒内唤醒"
    immediate_capacity = f"{to_sleep_nodes} 个节点可立即启动"
    
    return {
        "strategy": {
            "sleep_periods": sleep_periods,
            "running_nodes": f"{running_nodes} 个 ({running_pct*100:.0f}%)",
            "to_sleep_nodes": f"{to_sleep_nodes} 个 ({to_sleep_pct*100:.0f}%)",
            "sleeping_nodes": f"{sleeping_nodes} 个 ({sleeping_pct*100:.0f}%)"
        },
        "effects": {
            "avg_utilization": f"{avg_util:.1f}%",
            "optimized_utilization": f"{optimized_util:.1f}%",
            "load_stability": load_stability,
            "peak_utilization": f"{max_util:.1f}%",
            "min_utilization": f"{min_util:.1f}%",
            "utilization_range": f"{min_util:.1f}% - {max_util:.1f}%",
            "suggested_daily_energy": f"{suggested_daily_energy:.1f} kWh",
            "actual_daily_energy": f"{actual_daily_energy:.1f} kWh",
            "saving_efficiency": f"{saving_efficiency:.2f}%"
        },
        "impact": {
            "delay": delay,
            "queue_risk": queue_risk,
            "immediate_capacity": immediate_capacity,
            "emergency_response": emergency_response
        }
    }
