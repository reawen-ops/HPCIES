from __future__ import annotations

from typing import List, Literal

from pydantic import BaseModel, Field


class ClusterStats(BaseModel):
    today_saving_percent: float | None = Field(
        None, description="今日预计节能百分比（由大模型提供，当前占位）"
    )
    total_nodes: int = Field(..., description="总节点数（来自用户配置）")
    running_nodes: int | None = Field(
        None, description="当前运行节点数（由大模型或调度策略提供，当前占位）"
    )
    today_tasks: int | None = Field(
        None, description="今日预计任务数（由大模型提供，当前占位）"
    )


class PredictionPoint(BaseModel):
    hour: int
    full_load: float
    energy_saving: float


class PredictionResponse(BaseModel):
    labels: List[str]
    full_load: List[float]
    energy_saving: List[float]
    strategy: dict
    effects: dict
    impact: dict


NodeStatus = Literal["running", "sleeping", "to_sleep"]


class NodeState(BaseModel):
    node_id: int
    status: NodeStatus


class NodeMatrixResponse(BaseModel):
    total_nodes: int
    nodes: List[NodeState]


class ChatMessage(BaseModel):
    id: int
    author: Literal["user", "ai"]
    text: str


class ChatMessageCreate(BaseModel):
    text: str


class ChatHistoryResponse(BaseModel):
    messages: List[ChatMessage]


class ConfigRequest(BaseModel):
    node_count: int
    core_per_node: int


class LoadPredictionRequest(BaseModel):
    history_24h: List[float] = Field(..., description="前 24 小时的 CPU 核时使用量列表")
    last_timestamp: str = Field(..., description="最后时间戳，格式为 YYYY-MM-DD HH:MM:SS")


class LoadPredictionResponse(BaseModel):
    predicted_load: float = Field(..., description="预测的负载")
    suggested_nodes: int = Field(..., description="建议开启的节点数")


class DatePredictionResponse(BaseModel):
    date: str
    labels: List[str]
    predicted_loads: List[float | None]
    suggested_nodes: List[int | None]
    utilization: List[float]
    energy_saving: List[float]
    strategy: dict
    effects: dict
    impact: dict


class HistoryDay(BaseModel):
    date: str


class HistoryMonth(BaseModel):
    month: int
    days: List[HistoryDay]


class HistoryYear(BaseModel):
    year: int
    months: List[HistoryMonth]


class HistoryTreeResponse(BaseModel):
    years: List[HistoryYear]


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthUser(BaseModel):
    id: int
    username: str


class AuthSessionResponse(BaseModel):
    token: str
    expires_at: str
    user: AuthUser


class MeResponse(BaseModel):
    user: AuthUser
    profile: dict
