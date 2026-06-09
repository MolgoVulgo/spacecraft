from __future__ import annotations

from contextlib import contextmanager
from typing import Callable, Optional, Tuple

from ursina import Entity, Vec3, application, camera, held_keys, mouse, window

from .core import CoreChange, PieceEditorCore
from .models import Cell, PieceInstance
from .viewer import EditorViewer


class ViewportInputBridge(Entity):
    def __init__(self, controller: "ViewportController") -> None:
        super().__init__(name="viewport_input_bridge", eternal=True, ignore_paused=True)
        self.controller = controller

    def input(self, key):  # noqa: ANN001 - Ursina callback signature
        self.controller.handle_input(key)

    def update(self) -> None:
        self.controller.update()


class ViewportController:
    def __init__(
        self,
        core: PieceEditorCore,
        viewer: EditorViewer,
        on_state_changed: Optional[Callable[[Optional[str]], None]] = None,
    ) -> None:
        self.core = core
        self.viewer = viewer
        self.on_state_changed = on_state_changed
        self.dragging_instance_index: Optional[int] = None
        self.drag_plane_scene_y: Optional[float] = None
        self.drag_offset_x = 0.0
        self.drag_offset_y = 0.0

    @property
    def mode(self) -> str:
        return self.core.mode

    @property
    def instances(self):
        return self.core.instances

    def selected_instance(self) -> Optional[PieceInstance]:
        return self.core.selected_instance()

    def apply_core_change(self, change: CoreChange) -> None:
        if change.redraw:
            self.redraw()
        if change.recenter:
            self.center_scene(announce=False)
        self._notify(change.message)

    def _notify(self, message: Optional[str] = None) -> None:
        if self.on_state_changed is not None:
            self.on_state_changed(message)

    def toggle_grid(self) -> None:
        self.viewer.set_grid_enabled(not self.viewer.grid_enabled)
        self._notify(f"Grid {'enabled' if self.viewer.grid_enabled else 'disabled'}")

    def toggle_anchor_visibility(self) -> None:
        self.viewer.set_anchors_enabled(not self.viewer.anchors_enabled)
        self.redraw()
        self._notify(f"Anchor display {'enabled' if self.viewer.anchors_enabled else 'disabled'}")

    def toggle_envelope_outline(self) -> None:
        self.viewer.set_envelope_outline_enabled(not self.viewer.envelope_outline_enabled)
        self.redraw()
        self._notify(f"Bounds {'enabled' if self.viewer.envelope_outline_enabled else 'disabled'}")

    def select_next_instance(self) -> None:
        self.apply_core_change(self.core.select_next_instance())

    def delete_selected_instance(self) -> None:
        self.apply_core_change(self.core.delete_selected_instance())

    def toggle_anchor_at_cursor(self) -> None:
        self.apply_core_change(self.core.toggle_anchor_at_cursor())

    def toggle_solid_at_cursor(self) -> None:
        self.apply_core_change(self.core.toggle_solid_at_cursor())

    def move_cursor(self, delta: Cell) -> None:
        self.apply_core_change(self.core.move_cursor(delta))

    def move_selected_instance(self, delta: Tuple[float, float, float]) -> None:
        self.apply_core_change(self.core.move_selected_instance(delta))

    @contextmanager
    def pointer_override(self, pointer: Optional[Tuple[float, float, float, float]] = None):
        if pointer is None:
            yield
            return
        self.viewer.set_pointer_from_widget(*pointer)
        try:
            yield
        finally:
            self.viewer.clear_pointer_override()

    def begin_mouse_drag(self, pointer: Optional[Tuple[float, float, float, float]] = None) -> None:
        if self.mode != "assembly":
            return
        with self.pointer_override(pointer):
            hovered_index = self.viewer.pick_instance_index()
            if hovered_index is None:
                return
            self.apply_core_change(self.core.select_instance(hovered_index))
            selected = self.selected_instance()
            if not selected:
                return
            plane_y = selected.position[2] + (selected.piece.logical_size[2] / 2)
            hit_point = self.viewer.mouse_world_point_on_horizontal_plane(plane_y)
            if hit_point is None:
                return
            self.dragging_instance_index = hovered_index
            self.drag_plane_scene_y = plane_y
            self.drag_offset_x = hit_point.x - selected.position[0]
            self.drag_offset_y = hit_point.z - selected.position[1]
            self.redraw()

    def end_mouse_drag(self) -> None:
        self.dragging_instance_index = None
        self.drag_plane_scene_y = None

    def update_drag(self, pointer: Optional[Tuple[float, float, float, float]] = None) -> None:
        if self.dragging_instance_index is None or (pointer is None and not mouse.left):
            return
        if self.drag_plane_scene_y is None:
            return
        if not (0 <= self.dragging_instance_index < len(self.instances)):
            self.end_mouse_drag()
            return
        selected = self.instances[self.dragging_instance_index]
        with self.pointer_override(pointer):
            hit_point = self.viewer.mouse_world_point_on_horizontal_plane(self.drag_plane_scene_y)
            if hit_point is None:
                return
            new_position = self.core.candidate_drag_position(
                hit_point.x,
                hit_point.z,
                self.drag_offset_x,
                self.drag_offset_y,
                selected.position[2],
            )
            if new_position == selected.position:
                return
            self.apply_core_change(self.core.apply_drag_position(self.dragging_instance_index, new_position))

    def zoom_camera(self, direction: int) -> None:
        self.viewer.zoom_camera(direction)

    def handle_input(self, key: str) -> None:
        if key == "scroll up":
            self.zoom_camera(1)
            return
        if key == "scroll down":
            self.zoom_camera(-1)
            return
        if key == "left mouse down":
            self.begin_mouse_drag()
            return
        if key == "left mouse up":
            self.end_mouse_drag()
            return

        if key == "f1":
            self.apply_core_change(self.core.set_edit_mode())
        elif key == "f2":
            self.apply_core_change(self.core.set_assembly_mode())
        elif key == "tab":
            if self.mode == "assembly":
                self.select_next_instance()
        elif key == "space":
            self.toggle_solid_at_cursor()
        elif key == "r":
            self.toggle_anchor_at_cursor()
        elif key == "delete":
            self.delete_selected_instance()
        elif key == "c":
            self.center_scene()
        elif key == "v":
            self.toggle_anchor_visibility()
        elif key == "b":
            self.toggle_envelope_outline()
        elif key == "s" and (held_keys.get("control", 0) or held_keys.get("left control", 0) or held_keys.get("right control", 0)):
            self.apply_core_change(self.core.save_current_piece())
        elif key in {"w", "s", "a", "d", "q", "e"}:
            if mouse.right or mouse.middle:
                return
            delta = {
                "a": (-1, 0, 0),
                "d": (1, 0, 0),
                "w": (0, 1, 0),
                "s": (0, -1, 0),
                "q": (0, 0, -1),
                "e": (0, 0, 1),
            }[key]
            if self.mode == "edit":
                self.move_cursor(delta)
            else:
                self.move_selected_instance((delta[0] * 0.5, delta[1] * 0.5, delta[2] * 0.5))
        elif key == "1":
            self.apply_core_change(self.core.prev_material())
        elif key == "2":
            self.apply_core_change(self.core.next_material())
        elif key == "3":
            self.apply_core_change(self.core.prev_base_size())
        elif key == "4":
            self.apply_core_change(self.core.next_base_size())

    def redraw(self) -> None:
        if self.mode == "edit":
            self.viewer.draw_edit_piece(self.core.current_piece, self.core.cursor)
        else:
            self.viewer.draw_assembly(self.core.instances, self.core.selected_instance_index)

    def update(self) -> None:
        self.update_drag()

    def current_scene_center_and_size(self) -> Tuple[Vec3, float]:
        center, size = self.core.current_scene_center_and_size()
        return Vec3(center[0], center[1], center[2]), size

    def center_scene(self, announce: bool = True) -> None:
        center, size = self.current_scene_center_and_size()
        self.viewer.center_scene(center, size)
        if announce:
            self._notify("Scene centered")


def disable_ursina_dev_widgets() -> None:
    for attr in ("exit_button", "cog_button", "fps_counter", "entity_counter", "collider_counter"):
        widget = getattr(window, attr, None)
        if widget is not None:
            try:
                widget.visible = False
            except Exception:
                pass
    try:
        application.hot_reloader.enabled = False
    except Exception:
        pass


def set_default_camera_pose() -> None:
    camera.position = (8, 10, -16)
    camera.rotation_x = 35
    camera.rotation_y = -28
