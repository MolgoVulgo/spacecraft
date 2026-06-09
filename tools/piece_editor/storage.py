from __future__ import annotations

import json
from pathlib import Path
from typing import List, Union

from .models import Piece


def load_catalog(path: Union[str, Path]) -> List[Piece]:
    source = Path(path)
    if not source.exists():
        return []
    with source.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return [Piece.from_dict(item) for item in data.get("pieces", [])]


def save_piece(piece: Piece, path: Union[str, Path]) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8") as handle:
        json.dump(piece.to_dict(), handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def save_catalog_piece(piece: Piece, path: Union[str, Path]) -> None:
    target = Path(path)
    pieces = load_catalog(target)
    replaced = False
    for index, existing in enumerate(pieces):
        if existing.id == piece.id:
            pieces[index] = piece.clone()
            replaced = True
            break
    if not replaced:
        pieces.append(piece.clone())

    payload = {"pieces": [item.to_dict() for item in pieces]}
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
