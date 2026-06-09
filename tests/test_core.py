from __future__ import annotations

import json
from pathlib import Path

from piece_editor.core import PieceEditorCore


def build_core(tmp_path: Path) -> PieceEditorCore:
    catalog_path = tmp_path / "pieces.json"
    user_piece_path = tmp_path / "user_piece.json"
    web_catalog_path = tmp_path / "4x3x1_catalog.json"
    return PieceEditorCore(catalog_path, user_piece_path, web_catalog_path)


def test_core_exposes_structured_state_snapshots(tmp_path: Path) -> None:
    core = build_core(tmp_path)

    assert core.get_mode() == "edit"
    assert core.get_current_piece().logical_size == (4, 3, 1)
    assert core.get_selected_instance_index() is None
    assert isinstance(core.get_shape_param_specs(), list)


def test_core_change_material_returns_refreshable_change(tmp_path: Path) -> None:
    core = build_core(tmp_path)

    change = core.on_material_selected("titane")

    assert change.redraw is True
    assert change.refresh_controls is True
    assert change.recenter is True
    assert core.get_current_piece().material == "titane"


def test_core_add_and_delete_instance_updates_state(tmp_path: Path) -> None:
    core = build_core(tmp_path)

    add_change = core.add_instance()

    assert add_change.recenter is True
    assert len(core.get_instances()) == 1
    assert core.get_selected_instance_index() == 0
    assert core.get_mode() == "assembly"

    delete_change = core.delete_selected_instance()

    assert delete_change.redraw is True
    assert len(core.get_instances()) == 0
    assert core.get_selected_instance_index() is None


def test_core_select_and_drag_instance_updates_core_state(tmp_path: Path) -> None:
    core = build_core(tmp_path)
    core.add_instance()

    select_change = core.select_instance(0)
    drag_change = core.apply_drag_position(0, (0.5, 0.0, 0.0))

    assert select_change.refresh_controls is False
    assert core.get_selected_instance_index() == 0
    assert drag_change.redraw is True
    assert core.get_instances()[0].position == (0.5, 0.0, 0.0)


def test_core_save_and_export_keep_paths_working(tmp_path: Path) -> None:
    core = build_core(tmp_path)

    save_change = core.save_current_piece()
    export_change = core.export_catalog_json()

    assert "Saved:" in str(save_change.message)
    assert "Exported catalog:" in str(export_change.message)
    assert core.catalog_path.exists()
    assert core.user_piece_path.exists()
    assert core.web_mesh_catalog_path.exists()

    with core.web_mesh_catalog_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    assert "pieces" in payload
