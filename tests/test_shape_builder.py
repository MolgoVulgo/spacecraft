from __future__ import annotations

from piece_editor.models import Piece
from piece_editor.shape_builder import build_generated_mesh


def test_build_generated_mesh_returns_box_geometry() -> None:
    piece = Piece.from_dict(
        {
            "id": "box-piece",
            "name": "Box Piece",
            "material": "acier",
            "logical_size": [4, 3, 1],
            "shape": {"kind": "box"},
        }
    )

    mesh = build_generated_mesh(piece)
    assert mesh is not None
    assert len(mesh.vertices) > 0
    assert len(mesh.faces) > 0


def test_build_generated_mesh_returns_source_mesh_for_custom_mesh() -> None:
    piece = Piece.from_dict(
        {
            "id": "custom-mesh-piece",
            "name": "Custom Mesh Piece",
            "material": "acier",
            "logical_size": [4, 3, 1],
            "shape": {"kind": "custom_mesh"},
            "source_mesh": {
                "vertices": [[-2.0, -1.5, -0.5], [2.0, -1.5, -0.5], [0.0, 1.5, 0.5]],
                "faces": [[0, 1, 2]],
            },
        }
    )

    mesh = build_generated_mesh(piece)
    assert mesh is not None
    assert mesh.vertices == [(-2.0, -1.5, -0.5), (2.0, -1.5, -0.5), (0.0, 1.5, 0.5)]
    assert mesh.faces == [(0, 1, 2)]
