from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple, Union

from .models import Anchor, Piece
from .shape_builder import GeneratedMesh, build_generated_mesh

UNIT_SCALE = 10


def _scene_vertex_to_web(vertex: Tuple[float, float, float], unit_scale: float) -> List[float]:
    x, y, z = vertex
    return [x * unit_scale, -z * unit_scale, y * unit_scale]


def _mesh_to_payload(mesh: GeneratedMesh, unit_scale: float = UNIT_SCALE) -> Dict[str, List[List[float]]]:
    return {
        "vertices": [_scene_vertex_to_web(vertex, unit_scale) for vertex in mesh.vertices],
        "faces": [[int(a), int(b), int(c)] for a, b, c in mesh.faces],
    }


def _mesh_stats(mesh_payload: Dict[str, List[List[float]]]) -> Dict[str, Union[int, bool]]:
    vertices = mesh_payload.get("vertices", [])
    faces = mesh_payload.get("faces", [])
    degenerate = 0
    for face in faces:
        if len({int(face[0]), int(face[1]), int(face[2])}) < 3:
            degenerate += 1
    return {
        "triangleCount": len(faces),
        "vertexCount": len(vertices),
        "closedMesh": degenerate == 0,
        "boundaryEdgeCount": 0,
        "nonManifoldEdgeCount": 0,
        "degenerateFaceCount": degenerate,
    }


def _mesh_bounds(mesh_payload: Dict[str, List[List[float]]]) -> Dict[str, List[float]]:
    vertices = mesh_payload.get("vertices", [])
    if not vertices:
        return {
            "min": [0.0, 0.0, 0.0],
            "max": [0.0, 0.0, 0.0],
            "center": [0.0, 0.0, 0.0],
            "dimensions": [0.0, 0.0, 0.0],
        }

    min_values = [min(vertex[index] for vertex in vertices) for index in range(3)]
    max_values = [max(vertex[index] for vertex in vertices) for index in range(3)]
    return {
        "min": min_values,
        "max": max_values,
        "center": [(min_values[index] + max_values[index]) / 2.0 for index in range(3)],
        "dimensions": [max_values[index] - min_values[index] for index in range(3)],
    }


def _shape_payload(piece: Piece) -> Dict[str, object]:
    params = dict(piece.shape)
    kind = str(params.pop("kind", "box"))
    return {
        "kind": kind,
        "variant": piece.variant,
        "params": params,
    }


def _anchor_payload(anchor: Anchor) -> Dict[str, object]:
    return {
        "id": anchor.id,
        "position": [anchor.position[0], anchor.position[1], anchor.position[2]],
        "normal": [anchor.normal[0], anchor.normal[1], anchor.normal[2]],
        "step": anchor.step,
        "side": anchor.side,
        "type": anchor.type,
    }


def _specs_payload(piece: Piece) -> Dict[str, Dict[str, object]]:
    return {key: value.to_dict() for key, value in piece.specs.items()}


def _resolve_mesh(piece: Piece) -> GeneratedMesh:
    generated_mesh = build_generated_mesh(piece)
    if generated_mesh and generated_mesh.vertices and generated_mesh.faces:
        return generated_mesh
    raise ValueError("No mesh available for piece '{}'".format(piece.id))


def piece_to_web_catalog_item(piece: Piece) -> Dict[str, object]:
    unit_scale = UNIT_SCALE
    mesh = _resolve_mesh(piece)
    mesh_payload = _mesh_to_payload(mesh, unit_scale=unit_scale)
    logical_size = [int(value) for value in piece.logical_size]
    return {
        "id": piece.id,
        "displayName": piece.name,
        "material": piece.material,
        "family": piece.family,
        "size": logical_size,
        "logicalSize": logical_size,
        "unitScale": unit_scale,
        "shape": _shape_payload(piece),
        "mesh": mesh_payload,
        "centeredMesh": mesh_payload,
        "anchors": [_anchor_payload(anchor) for anchor in piece.anchors],
        "symmetry": piece.symmetry.to_dict(),
        "specs": _specs_payload(piece),
        "bounds": _mesh_bounds(mesh_payload),
        "stats": _mesh_stats(mesh_payload),
        "sourceType": "python_generated",
    }


def export_web_catalog(
    pieces: List[Piece],
    target_path: Union[str, Path],
) -> None:
    target = Path(target_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    family = pieces[0].family if pieces else "catalog"
    payload = {
        "catalog": {
            "id": family,
            "family": family,
            "logicalSize": list(pieces[0].logical_size) if pieces else [4, 3, 1],
            "unitScale": UNIT_SCALE,
            "generatedFormat": "python_piece_catalog",
            "coordinateSystem": "x=length y=-width z=height",
            "centeredMesh": "vertices centered on the logical envelope in JS space",
            "sourceOfTruth": "tools/data/pieces.json",
        },
        "pieces": [piece_to_web_catalog_item(piece) for piece in pieces],
    }
    with target.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
