from __future__ import annotations

import json
from pathlib import Path

from piece_editor.catalog_export import export_web_catalog, piece_to_web_catalog_item
from piece_editor.models import Piece


def build_piece() -> Piece:
    return Piece.from_dict(
        {
            "id": "acier_4x3x1_standard",
            "name": "ACIER 4X3X1",
            "material": "acier",
            "logical_size": [4, 3, 1],
            "family": "4x3x1",
            "variant": "standard",
            "shape": {"kind": "box"},
            "anchors": [
                {
                    "id": "length_min_center",
                    "position": [0.0, 1.5, 0.5],
                    "normal": [-1, 0, 0],
                    "step": 0.5,
                    "side": "length_min",
                    "type": "snap",
                }
            ],
            "specs": {
                "mass": {
                    "label": "Masse",
                    "value": 30.0,
                    "unit": "t",
                }
            },
        }
    )


def test_piece_to_web_catalog_item_exports_required_fields() -> None:
    payload = piece_to_web_catalog_item(build_piece())
    for key in ("id", "displayName", "material", "family", "size", "unitScale", "shape", "mesh", "anchors", "symmetry", "specs"):
        assert key in payload
    assert payload["anchors"][0]["position"] == [0.0, 1.5, 0.5]
    assert payload["specs"]["mass"]["value"] == 30.0
    assert payload["symmetry"]["possible"] == ["length", "width", "height"]
    assert payload["symmetry"]["uiEnabled"] is False


def test_export_web_catalog_writes_valid_json(tmp_path: Path) -> None:
    target = tmp_path / "4x3x1_catalog.json"
    export_web_catalog([build_piece()], target)

    with target.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    assert "pieces" in payload
    assert payload["pieces"][0]["anchors"][0]["position"] == [0.0, 1.5, 0.5]
    assert isinstance(payload["pieces"][0]["mesh"]["vertices"], list)


def test_export_custom_mesh_does_not_need_legacy_catalog(tmp_path: Path) -> None:
    piece = Piece.from_dict(
        {
            "id": "custom-mesh-export",
            "name": "Custom Mesh Export",
            "material": "acier",
            "logical_size": [4, 3, 1],
            "shape": {"kind": "custom_mesh"},
            "source_mesh": {
                "vertices": [[-2.0, -1.5, -0.5], [2.0, -1.5, -0.5], [0.0, 1.5, 0.5]],
                "faces": [[0, 1, 2]],
            },
        }
    )
    target = tmp_path / "custom_catalog.json"

    export_web_catalog([piece], target)

    with target.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    assert payload["pieces"][0]["mesh"]["faces"] == [[0, 1, 2]]
