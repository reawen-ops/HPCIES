"""
    Pydantic 模型定义：
    - API响应模型，用于数据验证和类型转换。
    - API返回的数据结构，并定义了数据验证规则。
    - API请求
"""
from __future__ import annotations

from typing import List, Literal

from pydantic import BaseModel, Field


class ClusterStats(BaseModel):
    """ 集群状态统计信息 """
    total_nodes: int = Field(..., description="总节点数")
    core_per_node: int = Field(0, description="每节点核心数")
    total_cores: int = Field(0, description="总核心数")
    data_days: int = Field(0, description="历史数据天数")
    latest_date: str | None = Field(None, description="最新数据日期")
    avg_utilization: float = Field(0.0, description="平均利用率（%）")


class PredictionPoint(BaseModel):
    """ 单点预测数据 """
    hour: int
    full_load: float
    energy_saving: float


class PredictionResponse(BaseModel):
    """ 完整的预测结果响应 """
    labels: List[str]
    full_load: List[float]
    energy_saving: List[float]
    strategy: dict
    effects: dict
    impact: dict


NodeStatus = Literal["running", "sleeping", "to_sleep"] # 节点状态类型


class NodeState(BaseModel):
    """ 节点状态 """
    node_id: int
    status: NodeStatus


class NodeMatrixResponse(BaseModel):
    """ 节点矩阵响应 """
    total_nodes: int
    nodes: List[NodeState]


class ChatSession(BaseModel):
    """ 聊天会话 """
    id: int
    title: str
    created_at: str
    updated_at: str
    message_count: int = 0


class ChatSessionsResponse(BaseModel):
    """ 会话列表响应 """
    sessions: List[ChatSession]


class ChatMessage(BaseModel):
    """ 聊天消息"""
    id: int
    author: Literal["user", "ai"]
    text: str
    created_at: str


class ChatMessageCreate(BaseModel):
    """ 创建消息请求 """
    text: str
    session_id: int | None = None
    # 当前前端页面选中的预测日期，用于在聊天时附带该日期的预测/统计上下文（格式：YYYY-MM-DD）
    context_date: str | None = None


class ChatHistoryResponse(BaseModel):
    """ 会话历史响应 """
    session_id: int
    messages: List[ChatMessage]


class ConfigRequest(BaseModel):
    """ 配置请求 """
    node_count: int
    core_per_node: int


class LoadPredictionRequest(BaseModel):
    """ 负载预测请求 """
    history_24h: List[float] = Field(..., description="前24小时的CPU核时使用量列表")
    last_timestamp: str = Field(..., description="最后时间戳，格式为 YYYY-MM-DD HH:MM:SS")


class LoadPredictionResponse(BaseModel):
    """ 负载预测响应 """
    predicted_load: float = Field(..., description="预测的负载")
    suggested_nodes: int = Field(..., description="建议开启的节点数")


class DatePredictionResponse(BaseModel):
    """ 日期预测响应 """
    date: str
    labels: List[str]
    predicted_loads: List[float | None]
    suggested_nodes: List[int | None]
    # 实际负载（目标日期每个小时的 CPU 核时使用量），可能存在缺失值
    actual_loads: List[float | None] | None = None
    # 历史同期平均负载（按小时聚合的历史平均值）
    history_avg_loads: List[float | None] | None = None
    utilization: List[float]
    energy_saving: List[float]
    strategy: dict
    effects: dict
    impact: dict


class HistoryDay(BaseModel):
    """ 历史日期 """
    date: str


class HistoryMonth(BaseModel):
    """ 历史月份 """
    month: int
    days: List[HistoryDay]


class HistoryYear(BaseModel):
    """ 历史年份 """
    year: int
    months: List[HistoryMonth]


class HistoryTreeResponse(BaseModel):
    """ 历史数据树响应 """
    years: List[HistoryYear]


class RegisterRequest(BaseModel):
    """ 注册请求 """
    username: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)


class LoginRequest(BaseModel):
    """ 登录请求 """
    username: str
    password: str


class AuthUser(BaseModel):
    """ 认证用户信息 """
    id: int
    username: str


class AuthSessionResponse(BaseModel):
    """ 认证会话响应 """
    token: str
    expires_at: str
    user: AuthUser


class MeResponse(BaseModel):
    """ 当前用户信心响应 """
    user: AuthUser
    profile: dict
