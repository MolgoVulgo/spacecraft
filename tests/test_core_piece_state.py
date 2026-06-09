from __future__ import annotations

from pathlib import Path

from piece_editor.core import PieceEditorCore


def build_core(tmp_path: Path) -> PieceEditorCore:
    return PieceEditorCore(
        tmp_path / "pieces.json",
        tmp_path / "user_piece.json",
        tmp_path / "4x3x1_catalog.json",
    )


def test_material_change_updates_available_base_sizes(tmp_path: Path) -> None:
    core = build_core(tmp_path)

    core.on_material_selected("titane")

    assert core.get_current_piece().material == "titane"
    assert "16x6x2" in core.get_piece_size_options()


def test_base_size_change_clamps_cursor(tmp_path: Path) -> None:
    core = build_core(tmp_path)
    core.cursor = (7, 2, 1)

    core.on_piece_size_selected("4x3x1")

    assert core.cursor == (3, 2, 0)


def test_variant_change_updates_shape_params(tmp_path: Path) -> None:
    core = build_core(tmp_path)

    core.on_variant_selected("Pente longueur")

    specs = core.get_shape_param_specs()
    keys = [item["key"] for item in specs]
    assert core.get_current_piece().variant == "pente_longueur"
    assert "axis" in keys
    assert "profile" in keys


def test_voxel_mode_fills_empty_solid_cells(tmp_path: Path) -> None:
    core = build_core(tmp_path)
    core.current_piece.solid_cells = set()

    core.set_voxel_render_mode()

    assert core.get_current_piece().render_mode == "voxel"
    assert len(core.get_current_piece().solid_cells) > 0


def test_clear_volume_keeps_safe_fallback_cell(tmp_path: Path) -> None:
    core = build_core(tmp_path)
    core.fill_current_piece()

    core.clear_current_piece()

    assert core.get_current_piece().solid_cells == {(0, 0, 0)}
    assert core.cursor == (0, 0, 0)
