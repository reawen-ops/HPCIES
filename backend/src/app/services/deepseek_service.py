"""DeepSeek AI 服务集成模块"""

from __future__ import annotations

import os
import requests
from typing import List, Dict, Optional


class DeepSeekError(Exception):
    """DeepSeek API 调用异常"""
    pass


def get_deepseek_api_key() -> str:
    """
    从环境变量获取 DeepSeek API 密钥。
    
    Returns:
        API 密钥字符串
        
    Raises:
        DeepSeekError: 如果未配置 API 密钥
    """
    api_key = os.getenv("DEEPSEEK_API_KEY")
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
    调用 DeepSeek API 进行对话。
    
    Args:
        messages: 对话历史，格式为 [{"role": "user", "content": "..."}, ...]
        system_prompt: 系统提示词（可选）
        model: 模型名称，默认为 "deepseek-chat"
        temperature: 温度参数，控制随机性（0-2）
        max_tokens: 最大生成 token 数
        
    Returns:
        AI 回复的文本内容
        
    Raises:
        DeepSeekError: API 调用失败时抛出
    """
    try:
        api_key = get_deepseek_api_key()
    except DeepSeekError:
        # 如果没有配置 API 密钥，返回友好提示
        return "抱歉，AI 助手暂未配置。请联系管理员配置 DEEPSEEK_API_KEY 环境变量。"
    
    # 构建请求消息列表
    api_messages = []
    
    # 添加系统提示词
    if system_prompt:
        api_messages.append({"role": "system", "content": system_prompt})
    
    # 添加对话历史
    api_messages.extend(messages)
    
    # 准备请求
    url = "https://api.deepseek.com/v1/chat/completions"
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
        
        # 提取 AI 回复
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
    return """你是 HPC 能源管家 AI 助手，专门帮助用户管理和优化高性能计算集群的能源使用。

你的职责包括：
1. 解答用户关于 HPC 集群能源管理的问题
2. 分析负载预测数据，提供节能建议
3. 解释系统的预测结果和节能策略
4. 帮助用户理解集群配置和使用情况
5. 提供 HPC 调度和资源管理的最佳实践建议

回答时请：
- 使用专业但易懂的语言
- 提供具体、可操作的建议
- 结合用户的实际集群配置给出针对性建议
- 保持友好和耐心的态度
- 如果不确定，诚实地告知用户

请用中文回答所有问题。"""


def format_chat_history_for_api(
    chat_messages: List[Dict],
    max_history: int = 10,
) -> List[Dict[str, str]]:
    """
    将数据库中的聊天历史格式化为 DeepSeek API 所需的格式。
    
    Args:
        chat_messages: 数据库中的聊天消息列表
        max_history: 最多保留的历史消息数（默认10条，即5轮对话）
        
    Returns:
        格式化后的消息列表
    """
    # 只保留最近的 N 条消息
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
