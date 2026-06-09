from __future__ import annotations

import json

import pytest

from piece_editor.models import Anchor, Piece, PieceInstance


def test_piece_from_dict_loads_minimal_piece() -> None:
    piece = Piece.from_dict(
        {
            "id": "minimal",
            "name": "Minimal",
            "material": "acier",
            "logical_size": [4, 3, 1],
            "shape": {"kind": "box"},
        }
    )

    assert piece.id == "minimal"
    assert piece.logical_size == (4, 3, 1)
    assert piece.anchors == []


def test_piece_to_dict_is_json_serializable() -> None:
    piece = Piece.from_dict(
        {
            "id": "serializable",
            "name": "Serializable",
            "material": "acier",
            "logical_size": [4, 3, 1],
            "anchors": [
                {
                    "id": "a0",
                    "position": [0.5, 1.5, 0.5],
                    "normal": [1, 0, 0],
                    "step": 0.5,
                    "side": "length_max",
                    "type": "snap",
                }
            ],
        }
    )

    payload = piece.to_dict()
    assert "anchors" in payload
    json.dumps(payload)


def test_anchor_accepts_half_step_positions() -> None:
    anchor = Anchor("half", (0.5, 1.5, 0.0), (0, 0, 1))
    assert anchor.position == (0.5, 1.5, 0.0)


def test_anchor_rejects_non_half_step_positions() -> None:
    with pytest.raises(ValueError):
        Anchor("bad", (0.25, 1.0, 0.5), (0, 0, 1))


def test_anchor_rejects_non_cardinal_normal() -> None:
    with pytest.raises(ValueError):
        Anchor("bad", (0.5, 1.5, 0.5), (1, 1, 0))


def test_piece_from_dict_migrates_anchor_cells() -> None:
    piece = Piece.from_dict(
        {
            "id": "legacy",
            "name": "Legacy",
            "material": "acier",
            "logical_size": [4, 3, 1],
            "anchor_cells": [[0, 1, 0]],
        }
    )

    assert len(piece.anchors) == 3
    positions = {anchor.position for anchor in piece.anchors}
    assert positions == {(0.0, 1.5, 0.5), (0.5, 1.5, 0.0), (0.5, 1.5, 1.0)}


def test_piece_to_dict_does_not_require_anchor_cells() -> None:
    piece = Piece.from_dict(
        {
            "id": "new-format",
            "name": "New Format",
            "material": "acier",
            "logical_size": [4, 3, 1],
            "anchors": [
                {
                    "id": "anchor",
                    "position": [0.5, 0.5, 0.5],
                    "normal": [0, 0, 1],
                    "step": 0.5,
                }
            ],
        }
    )

    payload = piece.to_dict()
    assert "anchors" in payload
    assert "anchor_cells" not in payload


def test_piece_from_dict_loads_specs_and_fills_defaults() -> None:
    piece = Piece.from_dict(
        {
            "id": "spec-piece",
            "name": "Spec Piece",
            "material": "acier",
            "logical_size": [4, 3, 1],
            "specs": {
                "mass": {
                    "label": "Masse",
                    "value": 30.0,
                    "unit": "t",
                }
            },
        }
    )

    assert piece.specs["mass"].value == 30.0
    assert piece.specs["system"].label == "Apport système"
    assert piece.specs["system"].value == ""


def test_piece_constructor_fills_default_specs() -> None:
    piece = Piece(
        id="constructed",
        name="Constructed",
        material="acier",
        base_size=(4, 3, 1),
        logical_size=(4, 3, 1),
    )

    assert piece.specs["system"].label == "Apport système"
    assert piece.specs["mass"].unit == "t"


def test_piece_to_dict_preserves_specs() -> None:
    piece = Piece.from_dict(
        {
            "id": "spec-save",
            "name": "Spec Save",
            "material": "acier",
            "logical_size": [4, 3, 1],
            "specs": {
                "decoration": {
                    "label": "Capacité de décoration",
                    "value": 6.0,
                    "unit": "DP",
                }
            },
        }
    )

    payload = piece.to_dict()
    assert payload["specs"]["decoration"]["value"] == 6.0
    assert payload["specs"]["decoration"]["unit"] == "DP"


def test_world_anchor_uses_float_positions() -> None:
    piece = Piece.from_dict(
        {
            "id": "anchor-piece",
            "name": "Anchor Piece",
            "material": "acier",
            "logical_size": [4, 3, 2],
            "anchors": [
                {
                    "id": "a0",
                    "position": [0.5, 1.5, 1.0],
                    "normal": [1, 0, 0],
                    "step": 0.5,
                }
            ],
        }
    )
    instance = PieceInstance(id=1, piece=piece, position=(10, 2, 3))

    world_anchor = instance.world_anchors()[0]
    assert world_anchor.position == (10.5, 3.5, 4.0)


def test_mirror_anchor_keeps_half_step() -> None:
    piece = Piece.from_dict(
        {
            "id": "mirror-piece",
            "name": "Mirror Piece",
            "material": "acier",
            "logical_size": [4, 3, 2],
            "anchors": [
                {
                    "id": "a0",
                    "position": [0.5, 1.5, 1.0],
                    "normal": [1, 0, 0],
                    "step": 0.5,
                }
            ],
        }
    )

    piece.mirror_anchors("length")
    assert piece.anchors[0].position == (3.5, 1.5, 1.0)
    assert piece.anchors[0].normal == (-1, 0, 0)


def test_instance_mirror_width_transforms_anchor() -> None:
    piece = Piece.from_dict(
        {
            "id": "mirror-width-piece",
            "name": "Mirror Width Piece",
            "material": "acier",
            "logical_size": [4, 3, 2],
            "anchors": [
                {
                    "id": "a0",
                    "position": [1.0, 0.5, 1.0],
                    "normal": [0, 1, 0],
                    "step": 0.5,
                }
            ],
        }
    )
    instance = PieceInstance(id=1, piece=piece)

    instance.toggle_mirror("width")

    assert instance.transformed_anchors()[0].position == (1.0, 2.5, 1.0)
    assert instance.transformed_anchors()[0].normal == (0, -1, 0)


def test_instance_mirror_height_transforms_anchor() -> None:
    piece = Piece.from_dict(
        {
            "id": "mirror-height-piece",
            "name": "Mirror Height Piece",
            "material": "acier",
            "logical_size": [4, 3, 2],
            "anchors": [
                {
                    "id": "a0",
                    "position": [1.0, 1.5, 0.5],
                    "normal": [0, 0, 1],
                    "step": 0.5,
                }
            ],
        }
    )
    instance = PieceInstance(id=1, piece=piece)

    instance.toggle_mirror("height")

    assert instance.transformed_anchors()[0].position == (1.0, 1.5, 1.5)
    assert instance.transformed_anchors()[0].normal == (0, 0, -1)


def test_instance_mirrors_are_independent() -> None:
    piece = Piece.from_dict(
        {
            "id": "mirror-state-piece",
            "name": "Mirror State Piece",
            "material": "acier",
            "logical_size": [4, 3, 2],
        }
    )
    instance = PieceInstance(id=1, piece=piece)

    instance.toggle_mirror("length")
    instance.toggle_mirror("width")
    instance.toggle_mirror("height")

    assert instance.mirror_length is True
    assert instance.mirror_width is True
    assert instance.mirror_height is True

    instance.toggle_mirror("width")

    assert instance.mirror_length is True
    assert instance.mirror_width is False
    assert instance.mirror_height is True


def test_external_face_anchor_is_accepted() -> None:
    piece = Piece.from_dict(
        {
            "id": "face-anchor",
            "name": "Face Anchor",
            "material": "acier",
            "logical_size": [4, 3, 1],
            "anchors": [
                {
                    "id": "face",
                    "position": [0.0, 1.5, 0.5],
                    "normal": [-1, 0, 0],
                    "step": 0.5,
                }
            ],
        }
    )
    assert piece.anchors[0].position == (0.0, 1.5, 0.5)


def test_out_of_bounds_anchor_is_pruned() -> None:
    piece = Piece.from_dict(
        {
            "id": "bad-anchor",
            "name": "Bad Anchor",
            "material": "acier",
            "logical_size": [4, 3, 1],
            "anchors": [
                {
                    "id": "bad",
                    "position": [4.5, 1.5, 0.5],
                    "normal": [1, 0, 0],
                    "step": 0.5,
                }
            ],
        }
    )
    assert piece.anchors == []


def test_toggle_anchor_creates_face_points_on_boundary_cell() -> None:
    piece = Piece.from_dict(
        {
            "id": "toggle-anchor",
            "name": "Toggle Anchor",
            "material": "acier",
            "logical_size": [4, 3, 1],
        }
    )

    piece.toggle_anchor((0, 0, 0))

    positions = {anchor.position for anchor in piece.anchors}
    assert positions == {
        (0.0, 0.5, 0.5),
        (0.5, 0.0, 0.5),
        (0.5, 0.5, 0.0),
        (0.5, 0.5, 1.0),
    }
