from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple
import math

from .models import Piece

SceneVertex = Tuple[float, float, float]
Face = Tuple[int, int, int]


@dataclass(frozen=True)
class GeneratedMesh:
    vertices: List[SceneVertex]
    faces: List[Face]


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _center_scene_vertex(vertex: Tuple[float, float, float], size: Tuple[int, int, int]) -> SceneVertex:
    x, y, z = vertex
    sx, sy, sz = size
    return (
        x - (sx / 2),
        z - (sz / 2),
        y - (sy / 2),
    )


def _build_box(size: Tuple[int, int, int]) -> GeneratedMesh:
    sx, sy, sz = size
    vertices = [
        (0, 0, 0),
        (sx, 0, 0),
        (sx, sy, 0),
        (0, sy, 0),
        (0, 0, sz),
        (sx, 0, sz),
        (sx, sy, sz),
        (0, sy, sz),
    ]
    faces = [
        (0, 2, 1), (0, 3, 2),
        (4, 5, 6), (4, 6, 7),
        (0, 1, 5), (0, 5, 4),
        (1, 2, 6), (1, 6, 5),
        (2, 3, 7), (2, 7, 6),
        (3, 0, 4), (3, 4, 7),
    ]
    return GeneratedMesh(
        vertices=[_center_scene_vertex(vertex, size) for vertex in vertices],
        faces=faces,
    )


def _slope_height_at(shape: dict, position: float, span: float, max_height: int) -> float:
    profile = str(shape.get("profile", "linear"))
    start = float(shape.get("start", 0))
    end = float(shape.get("end", span))
    low = float(shape.get("low", 0))
    high = float(shape.get("high", max(1, max_height)))

    start = _clamp(start, 0.0, max(span - 1, 0.0))
    end = _clamp(end, start + 1.0, span)
    low = _clamp(low, 0.0, max_height)
    high = _clamp(high, 0.0, max_height)

    if profile == "double":
        midpoint = (start + end) / 2
        if position <= start or position >= end:
            return low
        if position <= midpoint:
            factor = (position - start) / max(midpoint - start, 0.0001)
            return low + ((high - low) * factor)
        factor = (position - midpoint) / max(end - midpoint, 0.0001)
        return high + ((low - high) * factor)

    if position <= start:
        return high if profile == "linear_inverse" else low
    if position >= end:
        return low if profile == "linear_inverse" else high

    factor = (position - start) / max(end - start, 0.0001)
    if profile == "linear_inverse":
        return high + ((low - high) * factor)
    return low + ((high - low) * factor)


def _extrude_profile(profile_points: List[Tuple[float, float]], depth: float, axis: str, size: Tuple[int, int, int]) -> GeneratedMesh:
    front_vertices = []
    back_vertices = []
    for u, height in profile_points:
        if axis == "length":
            front_vertices.append((u, 0.0, height))
            back_vertices.append((u, size[1], height))
        else:
            front_vertices.append((0.0, u, height))
            back_vertices.append((size[0], u, height))

    vertices = front_vertices + back_vertices
    point_count = len(profile_points)
    faces: List[Face] = []

    for index in range(1, point_count - 1):
        faces.append((0, index + 1, index))
        faces.append((point_count, point_count + index, point_count + index + 1))

    for index in range(point_count):
        next_index = (index + 1) % point_count
        a = index
        b = next_index
        c = point_count + next_index
        d = point_count + index
        faces.append((a, b, c))
        faces.append((a, c, d))

    return GeneratedMesh(
        vertices=[_center_scene_vertex(vertex, size) for vertex in vertices],
        faces=faces,
    )


def _build_slope(piece: Piece) -> GeneratedMesh:
    sx, sy, sz = piece.logical_size
    axis = str(piece.shape.get("axis", "length"))
    span = sx if axis == "length" else sy
    sample_positions = [0.0, float(piece.shape.get("start", 0)), float(piece.shape.get("end", span)), float(span)]
    unique_positions = sorted({ _clamp(value, 0.0, span) for value in sample_positions })
    top_points = [(position, _slope_height_at(piece.shape, position, span, sz)) for position in unique_positions]
    profile_points = [(0.0, 0.0), (span, 0.0)] + list(reversed(top_points))
    return _extrude_profile(profile_points, sy if axis == "length" else sx, axis, piece.logical_size)


def _build_triangle(piece: Piece) -> GeneratedMesh:
    shape = dict(piece.shape)
    shape.setdefault("low", 0)
    shape.setdefault("high", piece.logical_size[2])
    shape.setdefault("profile", "linear")
    triangle_piece = piece.clone()
    triangle_piece.shape = shape
    return _build_slope(triangle_piece)


def _rounded_profile_points(span: float, height: float, radius: float, side: str, segments: int = 8) -> List[Tuple[float, float]]:
    radius = _clamp(radius, 0.0, min(span, height))
    if radius <= 0.0001:
        return [(0.0, 0.0), (span, 0.0), (span, height), (0.0, height)]

    points: List[Tuple[float, float]] = []
    if side == "front":
        points.extend([(0.0, 0.0), (span, 0.0), (span, height), (radius, height)])
        center_x = radius
        center_y = height - radius
        for index in range(segments + 1):
            angle = (math.pi / 2) * (index / segments)
            x = center_x - (radius * math.cos(angle))
            y = center_y + (radius * math.sin(angle))
            points.append((x, y))
    elif side == "back":
        points.extend([(0.0, 0.0), (span, 0.0)])
        center_x = span - radius
        center_y = height - radius
        for index in range(segments + 1):
            angle = (math.pi / 2) * (index / segments)
            x = center_x + (radius * math.sin(angle))
            y = center_y + (radius * math.cos(angle))
            points.append((x, y))
        points.extend([(0.0, height)])
    elif side == "left":
        points.extend([(0.0, 0.0), (span, 0.0), (span, height), (radius, height)])
        center_x = radius
        center_y = height - radius
        for index in range(segments + 1):
            angle = (math.pi / 2) * (index / segments)
            x = center_x - (radius * math.cos(angle))
            y = center_y + (radius * math.sin(angle))
            points.append((x, y))
    else:
        points.extend([(0.0, 0.0), (span, 0.0)])
        center_x = span - radius
        center_y = height - radius
        for index in range(segments + 1):
            angle = (math.pi / 2) * (index / segments)
            x = center_x + (radius * math.sin(angle))
            y = center_y + (radius * math.cos(angle))
            points.append((x, y))
        points.extend([(0.0, height)])

    deduped: List[Tuple[float, float]] = []
    for point in points:
        if not deduped or abs(point[0] - deduped[-1][0]) > 0.0001 or abs(point[1] - deduped[-1][1]) > 0.0001:
            deduped.append(point)
    return deduped


def _build_round_side(piece: Piece) -> GeneratedMesh:
    sx, sy, sz = piece.logical_size
    side = str(piece.shape.get("side", "front"))
    radius = float(piece.shape.get("radius", 1.0))

    if side in {"front", "back"}:
        profile = _rounded_profile_points(sy, sz, radius, side)
        return _extrude_profile(profile, sx, "width", piece.logical_size)

    profile_side = "front" if side == "left" else "back"
    profile = _rounded_profile_points(sx, sz, radius, profile_side)
    return _extrude_profile(profile, sy, "length", piece.logical_size)


def _chamfer_profile_points(span: float, height: float, amount: float, side: str) -> List[Tuple[float, float]]:
    amount = _clamp(amount, 0.0, min(span, height))
    if amount <= 0.0001:
        return [(0.0, 0.0), (span, 0.0), (span, height), (0.0, height)]

    if side == "front":
        return [(0.0, 0.0), (span, 0.0), (span, height), (amount, height), (0.0, height - amount)]
    if side == "back":
        return [(0.0, 0.0), (span, 0.0), (span, height - amount), (span - amount, height), (0.0, height)]
    if side == "left":
        return [(0.0, 0.0), (span, 0.0), (span, height), (amount, height), (0.0, height - amount)]
    return [(0.0, 0.0), (span, 0.0), (span, height - amount), (span - amount, height), (0.0, height)]


def _build_chamfer(piece: Piece) -> GeneratedMesh:
    sx, sy, sz = piece.logical_size
    count = int(piece.shape.get("count", 1))
    side = str(piece.shape.get("side", "front"))
    amount = float(piece.shape.get("amount", 1.0))

    if side in {"front", "back"}:
        base_profile = _chamfer_profile_points(sy, sz, amount, side)
        if count == 2:
            other_side = "back" if side == "front" else "front"
            other_profile = _chamfer_profile_points(sy, sz, amount, other_side)
            if side == "front":
                base_profile = [(0.0, 0.0), (sy, 0.0), (sy, sz - amount), (sy - amount, sz), (amount, sz), (0.0, sz - amount)]
            else:
                base_profile = [(0.0, 0.0), (sy, 0.0), (sy, sz - amount), (sy - amount, sz), (amount, sz), (0.0, sz - amount)]
        return _extrude_profile(base_profile, sx, "width", piece.logical_size)

    base_profile = _chamfer_profile_points(sx, sz, amount, "front" if side == "left" else "back")
    if count == 2:
        base_profile = [(0.0, 0.0), (sx, 0.0), (sx, sz - amount), (sx - amount, sz), (amount, sz), (0.0, sz - amount)]
    return _extrude_profile(base_profile, sy, "length", piece.logical_size)


def _build_round_edge(piece: Piece) -> GeneratedMesh:
    sx, sy, sz = piece.logical_size
    edge = str(piece.shape.get("edge", "front_top"))
    radius = float(piece.shape.get("radius", 1.0))

    if edge in {"front_top", "front_bottom"}:
        side = "front"
        profile = _rounded_profile_points(sy, sz, radius, side)
        return _extrude_profile(profile, sx, "width", piece.logical_size)

    if edge in {"left_top", "left_bottom"}:
        profile = _rounded_profile_points(sx, sz, radius, "front")
        return _extrude_profile(profile, sy, "length", piece.logical_size)

    profile = _rounded_profile_points(sx, sz, radius, "back")
    return _extrude_profile(profile, sy, "length", piece.logical_size)


def build_generated_mesh(piece: Piece) -> Optional[GeneratedMesh]:
    kind = str(piece.shape.get("kind", "box"))
    if kind == "custom_mesh" and piece.source_mesh:
        return GeneratedMesh(vertices=list(piece.source_mesh.vertices), faces=list(piece.source_mesh.faces))
    if kind == "box":
        return _build_box(piece.logical_size)
    if kind == "slope":
        return _build_slope(piece)
    if kind == "triangle":
        return _build_triangle(piece)
    if kind == "round_side":
        return _build_round_side(piece)
    if kind == "chamfer":
        return _build_chamfer(piece)
    if kind == "round_edge":
        return _build_round_edge(piece)
    return None
