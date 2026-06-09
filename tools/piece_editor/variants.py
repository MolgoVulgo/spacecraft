from __future__ import annotations

from typing import Dict, List, Tuple

Size = Tuple[int, int, int]


def family_from_size(size: Size) -> str:
    return f"{size[0]}x{size[1]}x{size[2]}"


def _variant_template() -> List[Dict[str, object]]:
    return [
        {"id": "standard", "label": "Standard", "shape": {"kind": "box"}},
        {"id": "piece_2", "label": "Piece 2", "shape": {"kind": "custom_mesh"}},
        {"id": "arrondi_face_avant", "label": "Arrondi face avant", "shape": {"kind": "round_side", "side": "front", "radius": 1.0}},
        {"id": "chanfrin_1_cote", "label": "Chanfrin 1 cote", "shape": {"kind": "chamfer", "count": 1, "side": "front", "amount": 1.0}},
        {"id": "chanfrin_2_cote", "label": "Chanfrin 2 cote", "shape": {"kind": "chamfer", "count": 2, "side": "front", "amount": 1.0}},
        {"id": "pent2", "label": "Pente double", "shape": {"kind": "slope", "axis": "length", "profile": "double"}},
        {"id": "pente_longueur", "label": "Pente longueur", "shape": {"kind": "slope", "axis": "length", "profile": "linear"}},
        {"id": "pente_longueur_inverse", "label": "Pente longueur inverse", "shape": {"kind": "slope", "axis": "length", "profile": "linear_inverse"}},
        {"id": "pente_largeur", "label": "Pente largeur", "shape": {"kind": "slope", "axis": "width", "profile": "linear"}},
        {"id": "pente_largeur_inverse", "label": "Pente largeur inverse", "shape": {"kind": "slope", "axis": "width", "profile": "linear_inverse"}},
        {"id": "triangle_longueur", "label": "Triangle longueur", "shape": {"kind": "triangle", "axis": "length"}},
        {"id": "triangle_largeur", "label": "Triangle largeur", "shape": {"kind": "triangle", "axis": "width"}},
        {"id": "arrondi_arete_r1", "label": "Arrondi arete r1", "shape": {"kind": "round_edge", "edge": "front_top", "radius": 1.0}},
    ]


def _normalized_shape(shape: Dict[str, object], family: str) -> Dict[str, object]:
    size = tuple(int(part) for part in family.split("x"))
    sx, sy, sz = size
    normalized = dict(shape)
    kind = str(normalized.get("kind", "box"))

    if kind in {"slope", "triangle"}:
        axis = str(normalized.get("axis", "length"))
        span = sx if axis == "length" else sy
        normalized.setdefault("start", 0)
        normalized.setdefault("end", span)
        if kind == "slope":
            normalized.setdefault("low", 0)
            normalized.setdefault("high", sz)

    if kind == "round_side":
        normalized.setdefault("radius", min(1.0, float(max(1, min(sx, sy, sz)))))

    if kind == "round_edge":
        normalized.setdefault("radius", min(1.0, float(max(1, min(sx, sy, sz)))))

    if kind == "chamfer":
        normalized.setdefault("amount", min(1.0, float(max(1, min(sx, sy, sz)))))

    return normalized


def variants_for_family(family: str) -> List[Dict[str, object]]:
    variants = []
    for item in _variant_template():
        variant = dict(item)
        variant["shape"] = _normalized_shape(dict(item.get("shape", {"kind": "box"})), family)
        variants.append(variant)
    return variants


def variant_ids_for_family(family: str) -> List[str]:
    return [str(item["id"]) for item in variants_for_family(family)]


def variant_label_map(family: str) -> Dict[str, str]:
    return {str(item["id"]): str(item["label"]) for item in variants_for_family(family)}


def default_variant_for_family(family: str) -> str:
    return variant_ids_for_family(family)[0]


def default_shape_for_variant(family: str, variant: str) -> Dict[str, object]:
    for item in variants_for_family(family):
        if str(item["id"]) == variant:
            return dict(item.get("shape", {"kind": "box"}))
    return {"kind": "box"}
