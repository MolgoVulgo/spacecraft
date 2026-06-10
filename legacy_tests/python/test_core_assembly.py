from __future__ import annotations

from pathlib import Path

from piece_editor.core import PieceEditorCore


def build_core(tmp_path: Path) -> PieceEditorCore:
    return PieceEditorCore(
        tmp_path / "pieces.json",
        tmp_path / "user_piece.json",
        tmp_path / "4x3x1_catalog.json",
    )


def test_add_instance_chooses_non_overlapping_position(tmp_path: Path) -> None:
    core = build_core(tmp_path)

    core.add_instance()
    core.add_instance()

    first, second = core.get_instances()
    assert first.position != second.position
    assert second.position[0] >= first.piece.logical_size[0]


def test_delete_selected_instance_keeps_valid_selection_index(tmp_path: Path) -> None:
    core = build_core(tmp_path)

    core.add_instance()
    core.add_instance()
    core.add_instance()
    core.select_instance(1)

    core.delete_selected_instance()

    assert len(core.get_instances()) == 2
    assert core.get_selected_instance_index() == 1


def test_collision_blocks_overlapping_height_move(tmp_path: Path) -> None:
    core = build_core(tmp_path)

    core.add_instance()
    core.add_instance()
    first = core.get_instances()[0]
    second = core.get_instances()[1]
    second.position = first.position
    second.position = (first.position[0], first.position[1], first.position[2] + 1.0)
    core.select_instance(1)

    change = core.move_selected_instance((0.0, 0.0, -1.0))

    assert change.message == "Move blocked: logical envelope collision"
    assert core.get_instances()[1].position == (first.position[0], first.position[1], first.position[2] + 1.0)
