from __future__ import annotations

from piece_editor.interaction import candidate_drag_position, has_logical_overlap
from piece_editor.models import Piece, PieceInstance, bounds_overlap


def build_piece() -> Piece:
    return Piece.from_dict(
        {
            "id": "piece",
            "name": "Piece",
            "material": "acier",
            "logical_size": [4, 3, 1],
        }
    )


def test_candidate_drag_position_keeps_height() -> None:
    position = candidate_drag_position(6.2, 4.7, 0.2, 0.7, 3.5)
    assert position == (6.0, 4.0, 3.5)


def test_bounds_overlap_accepts_face_contact() -> None:
    piece = build_piece()
    left = PieceInstance(id=1, piece=piece, position=(0, 0, 0))
    right = PieceInstance(id=2, piece=piece, position=(4, 0, 0))

    assert bounds_overlap(left.world_bounds(), right.world_bounds()) is False


def test_bounds_overlap_rejects_positive_overlap() -> None:
    piece = build_piece()
    left = PieceInstance(id=1, piece=piece, position=(0, 0, 0))
    right = PieceInstance(id=2, piece=piece, position=(3.5, 0, 0))

    assert bounds_overlap(left.world_bounds(), right.world_bounds()) is True


def test_has_logical_overlap_rejects_drag_overlap() -> None:
    piece = build_piece()
    moving = PieceInstance(id=1, piece=piece, position=(0, 0, 2.0))
    other = PieceInstance(id=2, piece=piece, position=(4.0, 0, 2.0))

    assert has_logical_overlap(moving, (3.5, 0, 2.0), [moving, other], ignore_index=0) is True


def test_has_logical_overlap_allows_horizontal_drag_without_height_change() -> None:
    piece = build_piece()
    moving = PieceInstance(id=1, piece=piece, position=(0, 0, 2.0))
    other = PieceInstance(id=2, piece=piece, position=(9.0, 0, 2.0))
    new_position = candidate_drag_position(4.6, 1.2, 0.1, 0.2, moving.position[2])

    assert new_position[2] == moving.position[2]
    assert has_logical_overlap(moving, new_position, [moving, other], ignore_index=0) is False
