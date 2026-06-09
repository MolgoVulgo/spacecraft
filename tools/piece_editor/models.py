from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple, Union

from .variants import default_shape_for_variant, default_variant_for_family, family_from_size, variant_ids_for_family

Cell = Tuple[int, int, int]
Size = Tuple[int, int, int]
Bounds = Tuple[Cell, Cell]
AnchorPosition = Tuple[float, float, float]
AnchorNormal = Tuple[int, int, int]
SpecPrimitive = Union[int, float, str]
SceneVertex = Tuple[float, float, float]
Face = Tuple[int, int, int]

CARDINAL_NORMALS = {
    (-1, 0, 0),
    (1, 0, 0),
    (0, -1, 0),
    (0, 1, 0),
    (0, 0, -1),
    (0, 0, 1),
}
DEFAULT_SYMMETRY_AXES = ("length", "width", "height")
DEFAULT_SPEC_ORDER = (
    "system",
    "chassis",
    "mass",
    "fuselage",
    "heatCapacity",
    "thermalConductivity",
    "decoration",
)
DEFAULT_SPEC_TEMPLATES = {
    "system": ("Apport système", "SP"),
    "chassis": ("Châssis", ""),
    "mass": ("Masse", "t"),
    "fuselage": ("Fuselage", ""),
    "heatCapacity": ("Capacité thermique", "MJ/K"),
    "thermalConductivity": ("Conductibilité thermique de matériau", "W/aK"),
    "decoration": ("Capacité de décoration", "DP"),
}


ALLOWED_BASE_SIZES = {
    "acier": {
        (4, 3, 1), (6, 3, 1), (8, 3, 1),
        (4, 3, 2), (6, 3, 2), (8, 3, 2),
    },
    "titane": {
        (4, 3, 1), (6, 3, 1), (8, 3, 1),
        (4, 3, 2), (6, 3, 2), (8, 3, 2),
        (8, 6, 2), (12, 6, 2), (16, 6, 2),
    },
}

DEFAULT_MATERIAL = "acier"
DEFAULT_BASE_SIZE = (4, 3, 1)


def full_envelope_cells(size: Size) -> Set[Cell]:
    sx, sy, sz = size
    return {(x, y, z) for x in range(sx) for y in range(sy) for z in range(sz)}


def normalize_material(value: object) -> str:
    material = str(value or DEFAULT_MATERIAL).strip().lower()
    if material not in ALLOWED_BASE_SIZES:
        return DEFAULT_MATERIAL
    return material


def normalize_base_size(material: str, size: object) -> Size:
    if isinstance(size, (list, tuple)) and len(size) == 3:
        normalized = tuple(int(v) for v in size)
    else:
        normalized = DEFAULT_BASE_SIZE

    if normalized in ALLOWED_BASE_SIZES[material]:
        return normalized

    if normalized in ALLOWED_BASE_SIZES[DEFAULT_MATERIAL]:
        return normalized

    return min(ALLOWED_BASE_SIZES[material], key=lambda item: (item[0], item[1], item[2]))


def normalize_shape_data(value: object) -> Dict[str, object]:
    if isinstance(value, dict):
        return dict(value)
    return {}


def is_half_step(value: float) -> bool:
    return abs((value * 2.0) - round(value * 2.0)) <= 0.000001


def center_position_from_cell(cell: Cell) -> AnchorPosition:
    return (float(cell[0]) + 0.5, float(cell[1]) + 0.5, float(cell[2]) + 0.5)


def face_anchor_position(cell: Cell, side: str) -> AnchorPosition:
    x, y, z = cell
    if side == "length_min":
        return (float(x), float(y) + 0.5, float(z) + 0.5)
    if side == "length_max":
        return (float(x) + 1.0, float(y) + 0.5, float(z) + 0.5)
    if side == "width_min":
        return (float(x) + 0.5, float(y), float(z) + 0.5)
    if side == "width_max":
        return (float(x) + 0.5, float(y) + 1.0, float(z) + 0.5)
    if side == "height_min":
        return (float(x) + 0.5, float(y) + 0.5, float(z))
    if side == "height_max":
        return (float(x) + 0.5, float(y) + 0.5, float(z) + 1.0)
    raise ValueError("Unknown anchor side: {}".format(side))


def face_anchor_normal(side: str) -> AnchorNormal:
    if side == "length_min":
        return (-1, 0, 0)
    if side == "length_max":
        return (1, 0, 0)
    if side == "width_min":
        return (0, -1, 0)
    if side == "width_max":
        return (0, 1, 0)
    if side == "height_min":
        return (0, 0, -1)
    if side == "height_max":
        return (0, 0, 1)
    raise ValueError("Unknown anchor side: {}".format(side))


@dataclass(frozen=True)
class Anchor:
    id: str
    position: AnchorPosition
    normal: AnchorNormal
    step: float = 0.5
    side: str = ""
    type: str = "snap"

    def __post_init__(self) -> None:
        position = tuple(float(value) for value in self.position)
        normal = tuple(int(value) for value in self.normal)
        object.__setattr__(self, "position", position)
        object.__setattr__(self, "normal", normal)
        object.__setattr__(self, "step", float(self.step))
        if self.step != 0.5:
            raise ValueError("Anchor step must be 0.5")
        if len(position) != 3 or not all(is_half_step(value) for value in position):
            raise ValueError("Anchor position must use 0.5 increments")
        if normal not in CARDINAL_NORMALS:
            raise ValueError("Anchor normal must be cardinal")

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "Anchor":
        return cls(
            id=str(data.get("id", "anchor")),
            position=tuple(float(value) for value in data.get("position", (0.5, 0.5, 0.5))),
            normal=tuple(int(value) for value in data.get("normal", (0, 0, 1))),
            step=float(data.get("step", 0.5)),
            side=str(data.get("side", "")),
            type=str(data.get("type", "snap")),
        )

    @classmethod
    def from_cell(cls, cell: Cell, index: int = 0) -> "Anchor":
        return cls(
            id="anchor_cell_{}_{}".format("_".join(str(value) for value in cell), index),
            position=center_position_from_cell(cell),
            normal=(0, 0, 1),
            step=0.5,
            side="cell_center",
            type="snap",
        )

    def to_dict(self) -> Dict[str, object]:
        return {
            "id": self.id,
            "position": [self.position[0], self.position[1], self.position[2]],
            "normal": [self.normal[0], self.normal[1], self.normal[2]],
            "step": self.step,
            "side": self.side,
            "type": self.type,
        }


@dataclass(frozen=True)
class SpecValue:
    label: str
    value: SpecPrimitive
    unit: str = ""

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "SpecValue":
        return cls(
            label=str(data.get("label", "")),
            value=data.get("value", ""),
            unit=str(data.get("unit", "")),
        )

    def to_dict(self) -> Dict[str, object]:
        return {
            "label": self.label,
            "value": self.value,
            "unit": self.unit,
        }


@dataclass(frozen=True)
class SymmetryInfo:
    possible: Tuple[str, ...] = DEFAULT_SYMMETRY_AXES
    ui_enabled: bool = False

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "SymmetryInfo":
        possible_raw = data.get("possible", DEFAULT_SYMMETRY_AXES)
        possible = tuple(str(value) for value in possible_raw if str(value) in DEFAULT_SYMMETRY_AXES)
        return cls(
            possible=possible or DEFAULT_SYMMETRY_AXES,
            ui_enabled=bool(data.get("uiEnabled", data.get("ui_enabled", False))),
        )

    def to_dict(self) -> Dict[str, object]:
        return {
            "possible": list(self.possible),
            "uiEnabled": self.ui_enabled,
        }


@dataclass(frozen=True)
class SourceMesh:
    vertices: List[SceneVertex]
    faces: List[Face]

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "SourceMesh":
        vertices = [tuple(float(value) for value in vertex) for vertex in data.get("vertices", [])]
        faces = [tuple(int(value) for value in face) for face in data.get("faces", []) if len(face) == 3]
        return cls(vertices=vertices, faces=faces)

    def to_dict(self) -> Dict[str, object]:
        return {
            "vertices": [[x, y, z] for x, y, z in self.vertices],
            "faces": [[a, b, c] for a, b, c in self.faces],
        }


def normalize_specs_data(value: object) -> Dict[str, SpecValue]:
    output = {}
    if isinstance(value, dict):
        for key, item in value.items():
            if isinstance(item, dict):
                output[str(key)] = SpecValue.from_dict(item)
            elif isinstance(item, SpecValue):
                output[str(key)] = SpecValue(item.label, item.value, item.unit)
    for key in DEFAULT_SPEC_ORDER:
        if key not in output:
            label, unit = DEFAULT_SPEC_TEMPLATES[key]
            output[key] = SpecValue(label=label, value="", unit=unit)
        else:
            label, unit = DEFAULT_SPEC_TEMPLATES.get(key, (output[key].label, output[key].unit))
            current = output[key]
            output[key] = SpecValue(
                label=current.label or label,
                value=current.value,
                unit=current.unit or unit,
            )
    return output


def normalize_source_mesh_data(value: object) -> Optional[SourceMesh]:
    if isinstance(value, dict):
        source_mesh = SourceMesh.from_dict(value)
        if source_mesh.vertices and source_mesh.faces:
            return source_mesh
    return None


@dataclass
class Piece:
    """Logical piece definition.

    base_size/logical_size are authoritative and must match one allowed template.
    solid_cells define the edited shape inside the fixed 1x1x1 envelope grid.
    anchors define logical snap points and do not resize the piece envelope.
    """

    id: str
    name: str
    material: str
    base_size: Size
    logical_size: Size
    family: str = ""
    variant: str = "standard"
    render_mode: str = "variant"
    shape: Dict[str, object] = field(default_factory=dict)
    mesh_id: str = ""
    source_mesh: Optional[SourceMesh] = None
    solid_cells: Set[Cell] = field(default_factory=set)
    anchors: List[Anchor] = field(default_factory=list)
    specs: Dict[str, SpecValue] = field(default_factory=dict)
    symmetry: SymmetryInfo = field(default_factory=SymmetryInfo)
    anchor_cells: Set[Cell] = field(default_factory=set)

    def __post_init__(self) -> None:
        self.shape = normalize_shape_data(self.shape)
        self.source_mesh = normalize_source_mesh_data(
            self.source_mesh.to_dict() if isinstance(self.source_mesh, SourceMesh) else self.source_mesh
        )
        self.specs = normalize_specs_data(self.specs)
        if not isinstance(self.symmetry, SymmetryInfo):
            self.symmetry = SymmetryInfo.from_dict(self.symmetry if isinstance(self.symmetry, dict) else {})

    @classmethod
    def from_dict(cls, data: Dict) -> "Piece":
        material = normalize_material(data.get("material", DEFAULT_MATERIAL))
        base_size = normalize_base_size(material, data.get("base_size", data.get("logical_size", DEFAULT_BASE_SIZE)))
        logical_size = tuple(int(v) for v in data.get("logical_size", base_size))
        if logical_size != base_size:
            logical_size = base_size
        solid_cells_raw = data.get("solid_cells")
        if solid_cells_raw is None:
            solid_cells = full_envelope_cells(logical_size)
        else:
            solid_cells = {tuple(int(c) for c in cell) for cell in solid_cells_raw}
        anchors_raw = data.get("anchors")
        if isinstance(anchors_raw, list) and anchors_raw:
            anchors = [Anchor.from_dict(item) for item in anchors_raw if isinstance(item, dict)]
            anchor_cells = {piece_cell_from_anchor_position(anchor.position) for anchor in anchors if piece_cell_from_anchor_position(anchor.position) is not None}
        else:
            anchor_cells = {tuple(int(c) for c in cell) for cell in data.get("anchor_cells", [])}
            anchors = [Anchor.from_cell(cell, index) for index, cell in enumerate(sorted(anchor_cells))]

        piece = cls(
            id=str(data.get("id", "piece")),
            name=str(data.get("name", data.get("id", "Piece"))),
            material=material,
            base_size=base_size,
            logical_size=logical_size,  # x = length, y = width, z = height
            family=str(data.get("family", family_from_size(base_size))),
            variant=str(data.get("variant", default_variant_for_family(family_from_size(base_size)))),
            render_mode=str(data.get("render_mode", "variant")),
            shape=normalize_shape_data(data.get("shape", {})),
            mesh_id=str(data.get("mesh_id", "")).strip(),
            source_mesh=normalize_source_mesh_data(data.get("source_mesh")),
            solid_cells=solid_cells,
            anchors=anchors,
            specs=normalize_specs_data(data.get("specs", {})),
            symmetry=SymmetryInfo.from_dict(data.get("symmetry", {})),
            anchor_cells=anchor_cells,
        )
        piece.validate_envelope()
        if not (isinstance(anchors_raw, list) and anchors_raw):
            piece.prune_anchor_cells()
        return piece

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "material": self.material,
            "base_size": list(self.base_size),
            "logical_size": list(self.logical_size),
            "family": self.family,
            "variant": self.variant,
            "render_mode": self.render_mode,
            "shape": self.shape,
            "mesh_id": self.mesh_id,
            "source_mesh": self.source_mesh.to_dict() if self.source_mesh else None,
            "solid_cells": [list(cell) for cell in sorted(self.solid_cells)],
            "anchors": [anchor.to_dict() for anchor in self.anchors],
            "specs": {key: value.to_dict() for key, value in self.specs.items()},
            "symmetry": self.symmetry.to_dict(),
        }

    def clone(self, piece_id: Optional[str] = None, name: Optional[str] = None) -> "Piece":
        return Piece(
            id=piece_id or self.id,
            name=name or self.name,
            material=self.material,
            base_size=self.base_size,
            logical_size=self.logical_size,
            family=self.family,
            variant=self.variant,
            render_mode=self.render_mode,
            shape=dict(self.shape),
            mesh_id=self.mesh_id,
            source_mesh=SourceMesh(list(self.source_mesh.vertices), list(self.source_mesh.faces)) if self.source_mesh else None,
            solid_cells=set(self.solid_cells),
            anchors=list(self.anchors),
            specs={key: SpecValue(value.label, value.value, value.unit) for key, value in self.specs.items()},
            symmetry=SymmetryInfo(tuple(self.symmetry.possible), self.symmetry.ui_enabled),
            anchor_cells=set(self.anchor_cells),
        )

    def validate_envelope(self) -> None:
        self.material = normalize_material(self.material)
        self.base_size = normalize_base_size(self.material, self.base_size)
        self.logical_size = self.base_size
        self.family = family_from_size(self.base_size)
        valid_variants = variant_ids_for_family(self.family)
        if self.variant not in valid_variants:
            self.variant = default_variant_for_family(self.family)
        if self.render_mode not in {"variant", "voxel"}:
            self.render_mode = "variant"
        default_shape = default_shape_for_variant(self.family, self.variant)
        merged_shape = dict(default_shape)
        merged_shape.update(normalize_shape_data(self.shape))
        self.shape = merged_shape
        self.prune_solid_cells()
        if not self.solid_cells:
            self.solid_cells = full_envelope_cells(self.logical_size)
        self.validate_anchors()

    def contains_cell(self, cell: Cell) -> bool:
        x, y, z = cell
        sx, sy, sz = self.logical_size
        return 0 <= x < sx and 0 <= y < sy and 0 <= z < sz

    def clamp_cell(self, cell: Cell) -> Cell:
        x, y, z = cell
        sx, sy, sz = self.logical_size
        return (
            min(max(x, 0), max(sx - 1, 0)),
            min(max(y, 0), max(sy - 1, 0)),
            min(max(z, 0), max(sz - 1, 0)),
        )

    def toggle_anchor(self, cell: Cell) -> None:
        cell = self.clamp_cell(cell)
        candidate_anchors = self.anchors_for_cell(cell)
        if not candidate_anchors:
            return
        candidate_keys = {(anchor.position, anchor.normal) for anchor in candidate_anchors}
        existing_keys = {(anchor.position, anchor.normal) for anchor in self.anchors}
        if candidate_keys.issubset(existing_keys):
            self.anchors = [
                anchor for anchor in self.anchors
                if (anchor.position, anchor.normal) not in candidate_keys
            ]
        else:
            filtered = [
                anchor for anchor in self.anchors
                if (anchor.position, anchor.normal) not in candidate_keys
            ]
            filtered.extend(candidate_anchors)
            self.anchors = filtered
        self.validate_anchors()

    def prune_solid_cells(self) -> None:
        self.solid_cells = {cell for cell in self.solid_cells if self.contains_cell(cell)}

    def fill_solid_cells(self) -> None:
        self.solid_cells = full_envelope_cells(self.logical_size)

    def prune_anchor_cells(self) -> None:
        migrated = []
        for index, cell in enumerate(sorted(self.anchor_cells)):
            if self.contains_cell(cell):
                migrated.extend(self.anchors_for_cell(cell, start_index=index * 6))
        self.anchors = migrated
        self.validate_anchors()

    def anchors_for_cell(self, cell: Cell, start_index: int = 0) -> List[Anchor]:
        x, y, z = cell
        sx, sy, sz = self.logical_size
        anchors = []
        sides = []
        if x == 0:
            sides.append("length_min")
        if x == sx - 1:
            sides.append("length_max")
        if y == 0:
            sides.append("width_min")
        if y == sy - 1:
            sides.append("width_max")
        if z == 0:
            sides.append("height_min")
        if z == sz - 1:
            sides.append("height_max")
        for index, side in enumerate(sides, start=start_index):
            anchors.append(
                Anchor(
                    id="anchor_{}_{}_{}".format(side, "_".join(str(value) for value in cell), index),
                    position=face_anchor_position(cell, side),
                    normal=face_anchor_normal(side),
                    step=0.5,
                    side=side,
                    type="snap",
                )
            )
        return anchors

    def validate_anchors(self) -> None:
        valid = []
        seen = set()
        sx, sy, sz = self.logical_size
        for anchor in self.anchors:
            x, y, z = anchor.position
            if not (0.0 <= x <= sx and 0.0 <= y <= sy and 0.0 <= z <= sz):
                continue
            key = (anchor.position, anchor.normal)
            if key in seen:
                continue
            seen.add(key)
            valid.append(anchor)
        self.anchors = valid
        self.anchor_cells = {
            cell for cell in (
                piece_cell_from_anchor_position(anchor.position) for anchor in self.anchors
            )
            if cell is not None and self.contains_cell(cell)
        }

    def toggle_solid(self, cell: Cell) -> None:
        cell = self.clamp_cell(cell)
        if cell in self.solid_cells:
            if len(self.solid_cells) > 1:
                self.solid_cells.remove(cell)
            return
        self.solid_cells.add(cell)

    def set_material_and_size(self, material: str, base_size: Size) -> None:
        previous_solids = set(self.solid_cells)
        previous_anchors = list(self.anchors)
        self.material = normalize_material(material)
        self.base_size = normalize_base_size(self.material, base_size)
        self.logical_size = self.base_size
        self.family = family_from_size(self.base_size)
        valid_variants = variant_ids_for_family(self.family)
        if self.variant not in valid_variants:
            self.variant = default_variant_for_family(self.family)
        if self.render_mode not in {"variant", "voxel"}:
            self.render_mode = "variant"
        default_shape = default_shape_for_variant(self.family, self.variant)
        merged_shape = dict(default_shape)
        merged_shape.update(normalize_shape_data(self.shape))
        self.shape = merged_shape
        remapped_solids = set()
        remapped_anchors = []
        for cell in previous_solids:
            if all(cell[index] < self.logical_size[index] for index in range(3)):
                remapped_solids.add(cell)
        for anchor in previous_anchors:
            x, y, z = anchor.position
            if 0.0 <= x <= self.logical_size[0] and 0.0 <= y <= self.logical_size[1] and 0.0 <= z <= self.logical_size[2]:
                remapped_anchors.append(anchor)
        self.solid_cells = remapped_solids or full_envelope_cells(self.logical_size)
        self.anchors = remapped_anchors
        self.prune_solid_cells()
        self.validate_anchors()

    def available_sizes(self) -> List[Size]:
        return sorted(ALLOWED_BASE_SIZES[self.material])

    def available_variants(self) -> List[str]:
        return variant_ids_for_family(self.family)

    def set_variant(self, variant: str) -> None:
        if variant not in self.available_variants():
            variant = default_variant_for_family(self.family)
        self.variant = variant
        self.render_mode = "variant"
        self.shape = dict(default_shape_for_variant(self.family, variant))

    def mirror_anchors(self, axis: str) -> None:
        sx, sy, sz = self.logical_size
        mirrored = []
        for anchor in self.anchors:
            x, y, z = anchor.position
            nx, ny, nz = anchor.normal
            if axis == "length":
                x = sx - x
                nx = -nx
            elif axis == "width":
                y = sy - y
                ny = -ny
            elif axis == "height":
                z = sz - z
                nz = -nz
            else:
                raise ValueError("Unknown mirror axis: {}".format(axis))
            mirrored.append(Anchor(anchor.id, (x, y, z), (nx, ny, nz), anchor.step, anchor.side, anchor.type))
        self.anchors = mirrored
        self.validate_anchors()

    def mirror_solids(self, axis: str) -> None:
        sx, sy, sz = self.logical_size
        mirrored = set()  # type: Set[Cell]
        for x, y, z in self.solid_cells:
            if axis == "length":
                x = sx - 1 - x
            elif axis == "width":
                y = sy - 1 - y
            elif axis == "height":
                z = sz - 1 - z
            else:
                raise ValueError("Unknown mirror axis: {}".format(axis))
            mirrored.add((x, y, z))
        self.solid_cells = mirrored

    def mirror_content(self, axis: str) -> None:
        self.mirror_solids(axis)
        self.mirror_anchors(axis)


@dataclass
class PieceInstance:
    id: int
    piece: Piece
    position: Cell = (0, 0, 0)
    mirror_length: bool = False
    mirror_width: bool = False
    mirror_height: bool = False
    color_name: str = "orange"

    def transformed_anchors(self) -> List[Anchor]:
        sx, sy, sz = self.piece.logical_size
        output = []
        for anchor in self.piece.anchors:
            x, y, z = anchor.position
            nx, ny, nz = anchor.normal
            if self.mirror_length:
                x = sx - x
                nx = -nx
            if self.mirror_width:
                y = sy - y
                ny = -ny
            if self.mirror_height:
                z = sz - z
                nz = -nz
            output.append(Anchor(anchor.id, (x, y, z), (nx, ny, nz), anchor.step, anchor.side, anchor.type))
        return output

    def transformed_solid_cells(self) -> Set[Cell]:
        sx, sy, sz = self.piece.logical_size
        output = set()  # type: Set[Cell]
        for x, y, z in self.piece.solid_cells:
            if self.mirror_length:
                x = sx - 1 - x
            if self.mirror_width:
                y = sy - 1 - y
            if self.mirror_height:
                z = sz - 1 - z
            output.add((x, y, z))
        return output

    def world_anchors(self, position: Optional[Cell] = None) -> List[Anchor]:
        px, py, pz = position if position is not None else self.position
        output = []
        for anchor in self.transformed_anchors():
            x, y, z = anchor.position
            output.append(
                Anchor(
                    anchor.id,
                    (x + px, y + py, z + pz),
                    anchor.normal,
                    anchor.step,
                    anchor.side,
                    anchor.type,
                )
            )
        return output

    def world_bounds(self, position: Optional[Cell] = None) -> Bounds:
        px, py, pz = position if position is not None else self.position
        sx, sy, sz = self.piece.logical_size
        return (px, py, pz), (px + sx, py + sy, pz + sz)

    def toggle_mirror(self, axis: str) -> None:
        if axis == "length":
            self.mirror_length = not self.mirror_length
        elif axis == "width":
            self.mirror_width = not self.mirror_width
        elif axis == "height":
            self.mirror_height = not self.mirror_height
        else:
            raise ValueError("Unknown mirror axis: {}".format(axis))

    def mirror_state_label(self) -> str:
        active = []  # type: List[str]
        if self.mirror_length:
            active.append("length")
        if self.mirror_width:
            active.append("width")
        if self.mirror_height:
            active.append("height")
        return " + ".join(active) if active else "none"


def bounds_overlap(a: Bounds, b: Bounds) -> bool:
    (ax1, ay1, az1), (ax2, ay2, az2) = a
    (bx1, by1, bz1), (bx2, by2, bz2) = b
    return (
        ax1 < bx2 and ax2 > bx1 and
        ay1 < by2 and ay2 > by1 and
        az1 < bz2 and az2 > bz1
    )


def piece_cell_from_anchor_position(position: AnchorPosition) -> Optional[Cell]:
    x, y, z = position
    if not (is_half_step(x) and is_half_step(y) and is_half_step(z)):
        return None
    xi = int(round(x - 0.5))
    yi = int(round(y - 0.5))
    zi = int(round(z - 0.5))
    return (xi, yi, zi)
