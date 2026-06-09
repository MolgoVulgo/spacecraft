from __future__ import annotations

from typing import Optional, Sequence, Tuple

from .models import PieceInstance, bounds_overlap


def round_half_step(value: float) -> float:
    return round(value * 2.0) / 2.0


def candidate_drag_position(
    hit_x: float,
    hit_z: float,
    drag_offset_x: float,
    drag_offset_y: float,
    current_height: float,
) -> Tuple[float, float, float]:
    return (
        round_half_step(hit_x - drag_offset_x),
        round_half_step(hit_z - drag_offset_y),
        current_height,
    )


def has_logical_overlap(
    moving_instance: PieceInstance,
    position: Tuple[float, float, float],
    instances: Sequence[PieceInstance],
    ignore_index: Optional[int] = None,
) -> bool:
    target_bounds = moving_instance.world_bounds(position)
    for index, other in enumerate(instances):
        if ignore_index is not None and index == ignore_index:
            continue
        if bounds_overlap(target_bounds, other.world_bounds()):
            return True
    return False
