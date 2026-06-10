from __future__ import annotations

from pathlib import Path

from piece_editor.models import Piece
from piece_editor.storage import load_catalog, save_catalog_piece


def test_load_catalog_returns_empty_list_for_missing_file(tmp_path: Path) -> None:
    missing = tmp_path / "missing.json"
    assert load_catalog(missing) == []


def test_save_catalog_piece_replaces_existing_piece(tmp_path: Path) -> None:
    target = tmp_path / "pieces.json"
    first = Piece.from_dict(
        {
            "id": "piece-a",
            "name": "Piece A",
            "material": "acier",
            "logical_size": [4, 3, 1],
        }
    )
    second = Piece.from_dict(
        {
            "id": "piece-a",
            "name": "Piece A Updated",
            "material": "titane",
            "logical_size": [4, 3, 1],
        }
    )

    save_catalog_piece(first, target)
    save_catalog_piece(second, target)

    pieces = load_catalog(target)
    assert len(pieces) == 1
    assert pieces[0].name == "Piece A Updated"
    assert pieces[0].material == "titane"
