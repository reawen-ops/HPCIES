"""Services package for business logic."""

from .lstm_service import (
    predict_24h_load,
    calculate_energy_saving_curve,
    generate_strategy_info,
    calculate_effects,
    calculate_impact,
    LSTMPredictionError,
)

__all__ = [
    "predict_24h_load",
    "calculate_energy_saving_curve",
    "generate_strategy_info",
    "calculate_effects",
    "calculate_impact",
    "LSTMPredictionError",
]
