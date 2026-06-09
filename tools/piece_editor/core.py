from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .catalog_export import export_web_catalog
from .interaction import candidate_drag_position, has_logical_overlap
from .models import ALLOWED_BASE_SIZES, DEFAULT_BASE_SIZE, DEFAULT_MATERIAL, DEFAULT_SPEC_ORDER, Piece, PieceInstance, normalize_specs_data
from .storage import load_catalog, save_catalog_piece, save_piece
from .variants import variant_label_map

Cell = Tuple[int, int, int]
ScenePoint = Tuple[float, float, float]


@dataclass
class CoreChange:
    redraw: bool = True
    refresh_controls: bool = True
    recenter: bool = False
    message: Optional[str] = None


class PieceEditorCore:
    def __init__(self, catalog_path: Path, user_piece_path: Path, web_mesh_catalog_path: Path) -> None:
        self.catalog_path = Path(catalog_path)
        self.user_piece_path = Path(user_piece_path)
        self.web_mesh_catalog_path = Path(web_mesh_catalog_path)
        self.catalog = load_catalog(self.catalog_path)
        if not self.catalog:
            self.catalog = [
                Piece(
                    id="empty_acier_4x3x1",
                    name="Empty acier 4x3x1",
                    material=DEFAULT_MATERIAL,
                    base_size=DEFAULT_BASE_SIZE,
                    logical_size=DEFAULT_BASE_SIZE,
                    family="4x3x1",
                    variant="standard",
                    render_mode="variant",
                    shape={"kind": "box"},
                    mesh_id="",
                    solid_cells={(0, 0, 0)},
                )
            ]

        self.catalog_index = 0
        self.current_piece = self.catalog[0].clone()
        self.cursor: Cell = (0, 0, 0)
        self.mode = "edit"
        self.instances: List[PieceInstance] = []
        self.selected_instance_index: Optional[int] = None
        self.next_instance_id = 1
        self.colors = ["orange", "blue", "green", "purple", "yellow", "red"]

    def _size_label(self, size: Tuple[int, int, int]) -> str:
        return f"{size[0]}x{size[1]}x{size[2]}"

    def _available_size_labels(self, material: str) -> List[str]:
        return [self._size_label(size) for size in sorted(ALLOWED_BASE_SIZES[material])]

    def _variant_map(self) -> Dict[str, str]:
        return variant_label_map(self.current_piece.family)

    def _variant_label_for_id(self, variant_id: str) -> str:
        return self._variant_map().get(variant_id, variant_id)

    def _variant_id_from_label(self, label: str) -> str:
        for variant_id, variant_label in self._variant_map().items():
            if variant_label == label:
                return variant_id
        return self.current_piece.variant

    def _update_piece_identity(self) -> None:
        size_label = self._size_label(self.current_piece.logical_size)
        variant_label = self._variant_label_for_id(self.current_piece.variant)
        self.current_piece.id = f"{self.current_piece.variant}_{self.current_piece.material}_{size_label}"
        self.current_piece.name = f"{variant_label} {self.current_piece.material} {size_label}"

    def _rename_current_piece(self) -> None:
        self.current_piece.mesh_id = ""
        self._update_piece_identity()

    def _normalize_shape_after_param_change(self) -> None:
        shape = self.current_piece.shape
        kind = str(shape.get("kind", "box"))
        sx, sy, sz = self.current_piece.logical_size
        if kind in {"slope", "triangle"}:
            axis = str(shape.get("axis", "length"))
            span = sx if axis == "length" else sy
            start = max(0, min(int(shape.get("start", 0)), max(span - 1, 0)))
            end = max(1, min(int(shape.get("end", span)), span))
            if end <= start:
                end = min(span, start + 1)
            shape["start"] = start
            shape["end"] = end
        if kind == "slope":
            shape["low"] = max(0, min(int(shape.get("low", 0)), max(sz - 1, 0)))
            shape["high"] = max(1, min(int(shape.get("high", max(1, sz))), max(1, sz)))
        if kind == "round_side":
            shape["side"] = str(shape.get("side", "front"))
            shape["radius"] = max(0.1, min(float(shape.get("radius", 1.0)), float(max(1, min(sx, sy, sz)))))
        if kind == "round_edge":
            shape["edge"] = str(shape.get("edge", "front_top"))
            shape["radius"] = max(0.1, min(float(shape.get("radius", 1.0)), float(max(1, min(sx, sy, sz)))))
        if kind == "chamfer":
            shape["side"] = str(shape.get("side", "front"))
            shape["count"] = max(1, min(int(shape.get("count", 1)), 2))
            shape["amount"] = max(0.1, min(float(shape.get("amount", 1.0)), float(max(1, min(sx, sy, sz)))))

    def _coerce_shape_param(self, key: str, value: str):
        if key in {"start", "end", "low", "high", "count"}:
            return int(value)
        if key in {"radius", "amount"}:
            return float(value)
        return value

    def get_material_options(self) -> List[str]:
        return sorted(ALLOWED_BASE_SIZES.keys())

    def get_piece_size_options(self) -> List[str]:
        return self._available_size_labels(self.current_piece.material)

    def get_variant_options(self) -> List[str]:
        return list(self._variant_map().values())

    def get_selected_variant_label(self) -> str:
        return self._variant_label_for_id(self.current_piece.variant)

    def get_mode(self) -> str:
        return self.mode

    def get_render_mode(self) -> str:
        return self.current_piece.render_mode

    def get_current_piece(self) -> Piece:
        return self.current_piece

    def get_instances(self) -> List[PieceInstance]:
        return self.instances

    def get_selected_instance_index(self) -> Optional[int]:
        return self.selected_instance_index

    def get_shape_param_specs(self) -> List[dict]:
        shape = self.current_piece.shape
        kind = str(shape.get("kind", "box"))
        sx, sy, sz = self.current_piece.logical_size

        if kind == "slope":
            axis = str(shape.get("axis", "length"))
            profile = str(shape.get("profile", "linear"))
            span = sx if axis == "length" else sy
            low = int(shape.get("low", 0))
            high = int(shape.get("high", max(1, sz)))
            start = int(shape.get("start", 0))
            end = int(shape.get("end", span))
            return [
                {"key": "axis", "label": "Slope axis", "options": ["length", "width"], "value": axis},
                {"key": "profile", "label": "Slope profile", "options": ["linear", "linear_inverse", "double"], "value": profile},
                {"key": "start", "label": "Start", "options": [str(i) for i in range(0, max(span, 1))], "value": str(start)},
                {"key": "end", "label": "End", "options": [str(i) for i in range(1, span + 1)], "value": str(end)},
                {"key": "low", "label": "Low", "options": [str(i) for i in range(0, max(sz, 1))], "value": str(low)},
                {"key": "high", "label": "High", "options": [str(i) for i in range(1, sz + 1)], "value": str(high)},
            ]

        if kind == "round_side":
            return [
                {"key": "side", "label": "Round side", "options": ["front", "back", "left", "right"], "value": str(shape.get("side", "front"))},
                {"key": "radius", "label": "Radius", "options": ["0.5", "1.0", "1.5"], "value": str(shape.get("radius", 1.0))},
            ]

        if kind == "round_edge":
            return [
                {"key": "edge", "label": "Round edge", "options": ["front_top", "left_top", "right_top"], "value": str(shape.get("edge", "front_top"))},
                {"key": "radius", "label": "Radius", "options": ["0.5", "1.0", "1.5"], "value": str(shape.get("radius", 1.0))},
            ]

        if kind == "triangle":
            axis = str(shape.get("axis", "length"))
            span = sx if axis == "length" else sy
            return [
                {"key": "axis", "label": "Triangle axis", "options": ["length", "width"], "value": axis},
                {"key": "start", "label": "Start", "options": [str(i) for i in range(0, max(span, 1))], "value": str(shape.get("start", 0))},
                {"key": "end", "label": "End", "options": [str(i) for i in range(1, span + 1)], "value": str(shape.get("end", span))},
            ]

        if kind == "chamfer":
            return [
                {"key": "count", "label": "Chamfer count", "options": ["1", "2"], "value": str(shape.get("count", 1))},
                {"key": "side", "label": "Chamfer side", "options": ["front", "back", "left", "right"], "value": str(shape.get("side", "front"))},
                {"key": "amount", "label": "Amount", "options": ["0.5", "1.0", "1.5"], "value": str(shape.get("amount", 1.0))},
            ]

        return []

    def get_status_model(self) -> Dict[str, object]:
        current_specs = normalize_specs_data(self.current_piece.specs)
        payload: Dict[str, object] = {
            "mode": self.mode,
            "current_piece": {
                "id": self.current_piece.id,
                "name": self.current_piece.name,
                "material": self.current_piece.material,
                "base_size": self.current_piece.base_size,
                "logical_size": self.current_piece.logical_size,
                "family": self.current_piece.family,
                "variant": self.current_piece.variant,
                "render_mode": self.current_piece.render_mode,
                "shape_kind": self.current_piece.shape.get("kind", "box"),
                "solid_cell_count": len(self.current_piece.solid_cells),
                "anchor_count": len(self.current_piece.anchors),
                "cursor": self.cursor,
                "cursor_solid": self.cursor in self.current_piece.solid_cells,
                "cursor_anchor": any(
                    anchor.position == (self.cursor[0] + 0.5, self.cursor[1] + 0.5, self.cursor[2] + 0.5)
                    for anchor in self.current_piece.anchors
                ),
                "specs": {key: current_specs[key].to_dict() for key in DEFAULT_SPEC_ORDER},
            },
            "instance_count": len(self.instances),
            "selected_instance_index": self.selected_instance_index,
            "selected_instance": None,
        }
        selected = self.selected_instance()
        if selected:
            selected_specs = normalize_specs_data(selected.piece.specs)
            payload["selected_instance"] = {
                "id": selected.id,
                "piece_name": selected.piece.name,
                "position": selected.position,
                "logical_size": selected.piece.logical_size,
                "mirrors": selected.mirror_state_label(),
                "specs": {key: selected_specs[key].to_dict() for key in DEFAULT_SPEC_ORDER},
            }
        return payload

    def current_scene_center_and_size(self) -> Tuple[ScenePoint, float]:
        if self.mode == "assembly" and self.instances:
            mins = [999999.0, 999999.0, 999999.0]
            maxs = [-999999.0, -999999.0, -999999.0]
            for instance in self.instances:
                (x1, y1, z1), (x2, y2, z2) = instance.world_bounds()
                mins[0] = min(mins[0], x1)
                mins[1] = min(mins[1], y1)
                mins[2] = min(mins[2], z1)
                maxs[0] = max(maxs[0], x2)
                maxs[1] = max(maxs[1], y2)
                maxs[2] = max(maxs[2], z2)
            lx = maxs[0] - mins[0]
            ly = maxs[1] - mins[1]
            lz = maxs[2] - mins[2]
            return (
                mins[0] + lx / 2,
                mins[2] + lz / 2,
                mins[1] + ly / 2,
            ), max(lx, ly, lz, 4)

        sx, sy, sz = self.current_piece.logical_size
        return (sx / 2, sz / 2, sy / 2), max(sx, sy, sz, 4)

    def selected_instance(self) -> Optional[PieceInstance]:
        if self.selected_instance_index is None:
            return None
        if not (0 <= self.selected_instance_index < len(self.instances)):
            return None
        return self.instances[self.selected_instance_index]

    def collides(self, instance: PieceInstance, position: Tuple[float, float, float], ignore_index: Optional[int]) -> bool:
        return has_logical_overlap(instance, position, self.instances, ignore_index=ignore_index)

    def candidate_drag_position(
        self,
        hit_x: float,
        hit_z: float,
        drag_offset_x: float,
        drag_offset_y: float,
        current_height: float,
    ) -> Tuple[float, float, float]:
        return candidate_drag_position(hit_x, hit_z, drag_offset_x, drag_offset_y, current_height)

    def next_free_position(self, piece: Piece) -> Tuple[float, float, float]:
        offset = 0.0
        probe = PieceInstance(id=0, piece=piece)
        while offset < 512:
            pos = (offset, 0.0, 0.0)
            if not self.collides(probe, pos, ignore_index=None):
                return pos
            offset += float(max(piece.logical_size[0], 1) + 1)
        return (0.0, 0.0, 0.0)

    def on_material_selected(self, value: str) -> CoreChange:
        self.current_piece.set_material_and_size(value, self.current_piece.base_size)
        self._rename_current_piece()
        self.cursor = self.current_piece.clamp_cell(self.cursor)
        return CoreChange(recenter=True)

    def on_variant_selected(self, value: str) -> CoreChange:
        self.current_piece.set_variant(self._variant_id_from_label(value))
        self._rename_current_piece()
        return CoreChange()

    def on_shape_param_selected(self, key: str, value: str) -> CoreChange:
        self.current_piece.render_mode = "variant"
        self.current_piece.shape[key] = self._coerce_shape_param(key, value)
        self._normalize_shape_after_param_change()
        self._rename_current_piece()
        return CoreChange()

    def set_variant_render_mode(self) -> CoreChange:
        self.current_piece.render_mode = "variant"
        return CoreChange()

    def set_voxel_render_mode(self) -> CoreChange:
        self.current_piece.render_mode = "voxel"
        if not self.current_piece.solid_cells:
            self.current_piece.fill_solid_cells()
        return CoreChange()

    def reset_current_shape(self) -> CoreChange:
        self.current_piece.set_variant(self.current_piece.variant)
        self.current_piece.fill_solid_cells()
        self._rename_current_piece()
        return CoreChange()

    def fill_current_piece(self) -> CoreChange:
        self.current_piece.render_mode = "voxel"
        self.current_piece.fill_solid_cells()
        self._rename_current_piece()
        return CoreChange(refresh_controls=False)

    def clear_current_piece(self) -> CoreChange:
        self.current_piece.render_mode = "voxel"
        self.current_piece.solid_cells = {(0, 0, 0)}
        self.current_piece.prune_solid_cells()
        self._rename_current_piece()
        self.cursor = self.current_piece.clamp_cell((0, 0, 0))
        return CoreChange(refresh_controls=False)

    def on_piece_size_selected(self, value: str) -> CoreChange:
        size = tuple(int(part) for part in value.split("x"))
        self.current_piece.set_material_and_size(self.current_piece.material, size)
        self._rename_current_piece()
        self.cursor = self.current_piece.clamp_cell(self.cursor)
        return CoreChange(recenter=True)

    def set_edit_mode(self) -> CoreChange:
        self.mode = "edit"
        self.selected_instance_index = None
        self.cursor = self.current_piece.clamp_cell(self.cursor)
        return CoreChange(refresh_controls=False)

    def set_assembly_mode(self) -> CoreChange:
        self.mode = "assembly"
        if self.instances and self.selected_instance_index is None:
            self.selected_instance_index = 0
        return CoreChange(refresh_controls=False)

    def prev_piece(self) -> CoreChange:
        self.catalog_index = (self.catalog_index - 1) % len(self.catalog)
        self.current_piece = self.catalog[self.catalog_index].clone()
        self.cursor = self.current_piece.clamp_cell((0, 0, 0))
        self.mode = "edit"
        return CoreChange(recenter=True)

    def next_piece(self) -> CoreChange:
        self.catalog_index = (self.catalog_index + 1) % len(self.catalog)
        self.current_piece = self.catalog[self.catalog_index].clone()
        self.cursor = self.current_piece.clamp_cell((0, 0, 0))
        self.mode = "edit"
        return CoreChange(recenter=True)

    def new_piece(self) -> CoreChange:
        self.current_piece = Piece(
            id="custom_acier_4x3x1",
            name="Custom acier 4x3x1",
            material=DEFAULT_MATERIAL,
            base_size=DEFAULT_BASE_SIZE,
            logical_size=DEFAULT_BASE_SIZE,
            family="4x3x1",
            variant="standard",
            render_mode="variant",
            shape={"kind": "box"},
            mesh_id="",
            solid_cells=set(),
        )
        self.current_piece.fill_solid_cells()
        self.cursor = (0, 0, 0)
        self.mode = "edit"
        return CoreChange(recenter=True)

    def prev_material(self) -> CoreChange:
        materials = sorted(ALLOWED_BASE_SIZES.keys())
        index = materials.index(self.current_piece.material)
        self.current_piece.set_material_and_size(materials[(index - 1) % len(materials)], self.current_piece.base_size)
        self._rename_current_piece()
        self.cursor = self.current_piece.clamp_cell(self.cursor)
        return CoreChange(recenter=True)

    def next_material(self) -> CoreChange:
        materials = sorted(ALLOWED_BASE_SIZES.keys())
        index = materials.index(self.current_piece.material)
        self.current_piece.set_material_and_size(materials[(index + 1) % len(materials)], self.current_piece.base_size)
        self._rename_current_piece()
        self.cursor = self.current_piece.clamp_cell(self.cursor)
        return CoreChange(recenter=True)

    def prev_base_size(self) -> CoreChange:
        sizes = self.current_piece.available_sizes()
        index = sizes.index(self.current_piece.base_size)
        self.current_piece.set_material_and_size(self.current_piece.material, sizes[(index - 1) % len(sizes)])
        self._rename_current_piece()
        self.cursor = self.current_piece.clamp_cell(self.cursor)
        return CoreChange(recenter=True)

    def next_base_size(self) -> CoreChange:
        sizes = self.current_piece.available_sizes()
        index = sizes.index(self.current_piece.base_size)
        self.current_piece.set_material_and_size(self.current_piece.material, sizes[(index + 1) % len(sizes)])
        self._rename_current_piece()
        self.cursor = self.current_piece.clamp_cell(self.cursor)
        return CoreChange(recenter=True)

    def save_current_piece(self) -> CoreChange:
        self.current_piece.validate_anchors()
        save_catalog_piece(self.current_piece, self.catalog_path)
        save_piece(self.current_piece, self.user_piece_path)
        self.catalog = load_catalog(self.catalog_path)
        export_web_catalog(self.catalog, self.web_mesh_catalog_path)
        for index, piece in enumerate(self.catalog):
            if piece.id == self.current_piece.id:
                self.catalog_index = index
                break
        return CoreChange(
            message="Saved: {} + {} + {}".format(
                self.catalog_path.name,
                self.user_piece_path.name,
                self.web_mesh_catalog_path.as_posix(),
            )
        )

    def export_catalog_json(self) -> CoreChange:
        self.current_piece.validate_anchors()
        save_catalog_piece(self.current_piece, self.catalog_path)
        self.catalog = load_catalog(self.catalog_path)
        export_web_catalog(self.catalog, self.web_mesh_catalog_path)
        return CoreChange(message="Exported catalog: {}".format(self.web_mesh_catalog_path.as_posix()))

    def add_instance(self) -> CoreChange:
        piece = self.current_piece.clone(piece_id=f"{self.current_piece.id}_source")
        color_name = self.colors[(self.next_instance_id - 1) % len(self.colors)]
        instance = PieceInstance(
            id=self.next_instance_id,
            piece=piece,
            position=self.next_free_position(piece),
            color_name=color_name,
        )
        self.next_instance_id += 1
        self.instances.append(instance)
        self.selected_instance_index = len(self.instances) - 1
        self.mode = "assembly"
        return CoreChange(recenter=True)

    def select_instance(self, index: Optional[int]) -> CoreChange:
        if index is None or not (0 <= index < len(self.instances)):
            self.selected_instance_index = None
            return CoreChange(redraw=False, refresh_controls=False)
        self.selected_instance_index = index
        self.mode = "assembly"
        return CoreChange(refresh_controls=False)

    def select_next_instance(self) -> CoreChange:
        if not self.instances:
            self.selected_instance_index = None
            return CoreChange(refresh_controls=False)
        if self.selected_instance_index is None:
            self.selected_instance_index = 0
        else:
            self.selected_instance_index = (self.selected_instance_index + 1) % len(self.instances)
        self.mode = "assembly"
        return CoreChange(refresh_controls=False)

    def delete_selected_instance(self) -> CoreChange:
        if self.selected_instance_index is None or not self.instances:
            return CoreChange(redraw=False, refresh_controls=False)
        del self.instances[self.selected_instance_index]
        if not self.instances:
            self.selected_instance_index = None
        else:
            self.selected_instance_index %= len(self.instances)
        return CoreChange(refresh_controls=False)

    def toggle_anchor_at_cursor(self) -> CoreChange:
        if self.mode != "edit":
            return CoreChange(redraw=False, refresh_controls=False)
        self.current_piece.toggle_anchor(self.cursor)
        return CoreChange(refresh_controls=False)

    def toggle_solid_at_cursor(self) -> CoreChange:
        if self.mode != "edit":
            return CoreChange(redraw=False, refresh_controls=False)
        self.current_piece.render_mode = "voxel"
        self._rename_current_piece()
        self.current_piece.toggle_solid(self.cursor)
        return CoreChange(refresh_controls=False)

    def move_cursor(self, delta: Cell) -> CoreChange:
        x, y, z = self.cursor
        dx, dy, dz = delta
        self.cursor = self.current_piece.clamp_cell((x + dx, y + dy, z + dz))
        return CoreChange(refresh_controls=False)

    def move_selected_instance(self, delta: Tuple[float, float, float]) -> CoreChange:
        selected = self.selected_instance()
        if not selected:
            return CoreChange(redraw=False, refresh_controls=False)
        px, py, pz = selected.position
        dx, dy, dz = delta
        new_position = candidate_drag_position(px + dx, py + dy, 0.0, 0.0, pz + dz)
        if self.collides(selected, new_position, ignore_index=self.selected_instance_index):
            return CoreChange(redraw=False, refresh_controls=False, message="Move blocked: logical envelope collision")
        selected.position = new_position
        return CoreChange(refresh_controls=False)

    def apply_drag_position(self, instance_index: int, position: Tuple[float, float, float]) -> CoreChange:
        if not (0 <= instance_index < len(self.instances)):
            return CoreChange(redraw=False, refresh_controls=False)
        selected = self.instances[instance_index]
        if position == selected.position:
            return CoreChange(redraw=False, refresh_controls=False)
        if self.collides(selected, position, ignore_index=instance_index):
            return CoreChange(redraw=False, refresh_controls=False)
        selected.position = position
        self.selected_instance_index = instance_index
        return CoreChange(refresh_controls=False)
