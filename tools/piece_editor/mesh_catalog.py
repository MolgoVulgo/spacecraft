from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple, Union

SceneVertex = Tuple[float, float, float]


@dataclass(frozen=True)
class MeshVariant:
    id: str
    logical_size: Tuple[int, int, int]
    vertices: List[SceneVertex]
    faces: List[Tuple[int, int, int]]


def _to_scene_vertex(vertex: List[float], unit_scale: float) -> SceneVertex:
    source_x, source_y, source_z = vertex
    return (
        float(source_x) / unit_scale,
        float(source_z) / unit_scale,
        float(-source_y) / unit_scale,
    )


def load_mesh_catalog(path: Union[str, Path]) -> Dict[str, MeshVariant]:
    with Path(path).open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    pieces = {}
    for item in data.get("pieces", []):
        logical_size = tuple(int(v) for v in item.get("logicalSize", [4, 3, 1]))
        unit_scale = float(item.get("unitScale", data.get("catalog", {}).get("unitScale", 10)) or 10)
        mesh_data = item.get("centeredMesh") or item.get("mesh") or {}
        vertices = [_to_scene_vertex(vertex, unit_scale) for vertex in mesh_data.get("vertices", [])]
        faces = [tuple(int(index) for index in face) for face in mesh_data.get("faces", []) if len(face) == 3]
        pieces[str(item.get("id", "")).strip()] = MeshVariant(
            id=str(item.get("id", "")).strip(),
            logical_size=logical_size,
            vertices=vertices,
            faces=faces,
        )
    return pieces
