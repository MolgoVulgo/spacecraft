from __future__ import annotations

import sys
from pathlib import Path
from typing import Callable, Optional

from PySide6.QtCore import QTimer, Qt
from PySide6.QtGui import QAction, QKeySequence, QShortcut
from PySide6.QtWidgets import QApplication, QDockWidget, QMainWindow, QStatusBar

from .core import CoreChange, PieceEditorCore
from .qt_theme import build_stylesheet
from .ui_panels import LeftControlPanel, RightInspectorPanel
from .viewport_widget import ViewportWidget

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "pieces.json"
USER_PIECE_PATH = ROOT / "data" / "user_piece.json"
WEB_MESH_CATALOG_PATH = ROOT.parent / "public" / "data" / "4x3x1_catalog.json"


class PieceEditorWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.core = PieceEditorCore(CATALOG_PATH, USER_PIECE_PATH, WEB_MESH_CATALOG_PATH)
        self.last_message = ""
        self.left_panel = LeftControlPanel(self._left_callbacks())
        self.right_panel = RightInspectorPanel()
        self.viewport = ViewportWidget(self.core, on_state_changed=self.on_viewport_state_changed)
        self.shortcuts: list[QShortcut] = []
        self.setWindowTitle("Python Piece Editor Shell")
        self.resize(1600, 900)
        self._build()
        QTimer.singleShot(0, self.viewport.focus_viewport)
        self.refresh_all()

    def _build(self) -> None:
        self.setCentralWidget(self.viewport)
        self._build_menu()
        self._build_shortcuts()

        left_dock = QDockWidget("Controls", self)
        left_dock.setWidget(self.left_panel)
        left_dock.setFeatures(QDockWidget.DockWidgetFeature.NoDockWidgetFeatures)
        left_dock.setMinimumWidth(300)
        left_dock.setMaximumWidth(340)
        self.addDockWidget(Qt.DockWidgetArea.LeftDockWidgetArea, left_dock)

        right_dock = QDockWidget("Inspector", self)
        right_dock.setWidget(self.right_panel)
        right_dock.setFeatures(QDockWidget.DockWidgetFeature.NoDockWidgetFeatures)
        right_dock.setMinimumWidth(320)
        right_dock.setMaximumWidth(380)
        self.addDockWidget(Qt.DockWidgetArea.RightDockWidgetArea, right_dock)

        status = QStatusBar()
        self.setStatusBar(status)
        status.showMessage("Native shell ready")

    def _add_shortcut(self, sequence: str, callback: Callable[[], None]) -> None:
        shortcut = QShortcut(QKeySequence(sequence), self)
        shortcut.setContext(Qt.ShortcutContext.ApplicationShortcut)
        shortcut.activated.connect(callback)
        self.shortcuts.append(shortcut)

    def _viewport_key(self, key: str) -> None:
        self.viewport.controller.handle_input(key)

    def _orbit_view(self, delta_yaw: float = 0.0, delta_pitch: float = 0.0) -> None:
        self.viewport.viewer.orbit_camera(delta_yaw=delta_yaw, delta_pitch=delta_pitch)

    def _build_shortcuts(self) -> None:
        for sequence, key in (
            ("F1", "f1"),
            ("F2", "f2"),
            ("Tab", "tab"),
            ("Space", "space"),
            ("R", "r"),
            ("Delete", "delete"),
            ("C", "c"),
            ("V", "v"),
            ("B", "b"),
            ("W", "w"),
            ("A", "a"),
            ("S", "s"),
            ("D", "d"),
            ("Q", "q"),
            ("E", "e"),
            ("1", "1"),
            ("2", "2"),
            ("3", "3"),
            ("4", "4"),
        ):
            self._add_shortcut(sequence, lambda key_name=key: self._viewport_key(key_name))
        self._add_shortcut("Ctrl+S", lambda: self._viewport_key("s"))
        self._add_shortcut("Left", lambda: self._orbit_view(delta_yaw=-10.0))
        self._add_shortcut("Right", lambda: self._orbit_view(delta_yaw=10.0))
        self._add_shortcut("Up", lambda: self._orbit_view(delta_pitch=-8.0))
        self._add_shortcut("Down", lambda: self._orbit_view(delta_pitch=8.0))

    def _add_action(self, menu, label: str, callback: Optional[Callable[[], None]], enabled: bool = True) -> QAction:
        action = QAction(label, self)
        action.setEnabled(enabled)
        if callback is not None and enabled:
            action.triggered.connect(callback)
        menu.addAction(action)
        return action

    def _build_menu(self) -> None:
        menu_bar = self.menuBar()
        file_menu = menu_bar.addMenu("File")
        self._add_action(file_menu, "Save Piece", self.save_piece)
        self._add_action(file_menu, "Export Catalog JSON", self.export_catalog)
        self._add_action(file_menu, "Quit", self.close)

        theme_menu = menu_bar.addMenu("Theme")
        self._add_action(theme_menu, "Reserved", None, enabled=False)

        config_menu = menu_bar.addMenu("Config")
        self._add_action(config_menu, "Toggle Grid", self.toggle_grid)
        self._add_action(config_menu, "Toggle Anchor Display", self.toggle_anchor_display)
        self._add_action(config_menu, "Project Folder", self.show_project_folder)

        help_menu = menu_bar.addMenu("Help")
        self._add_action(help_menu, "About", self.show_about)

    def _left_callbacks(self):
        return {
            "set_edit_mode": self.set_edit_mode,
            "set_assembly_mode": self.set_assembly_mode,
            "on_material_selected": self.on_material_selected,
            "on_piece_size_selected": self.on_piece_size_selected,
            "on_variant_selected": self.on_variant_selected,
            "on_shape_param_selected": self.on_shape_param_selected,
            "set_variant_render_mode": self.set_variant_render_mode,
            "set_voxel_render_mode": self.set_voxel_render_mode,
            "reset_current_shape": self.reset_current_shape,
            "fill_current_piece": self.fill_current_piece,
            "clear_current_piece": self.clear_current_piece,
            "prev_piece": self.prev_piece,
            "next_piece": self.next_piece,
            "new_piece": self.new_piece,
            "save_current_piece": self.save_piece,
            "toggle_solid_at_cursor": self.toggle_solid_at_cursor,
            "toggle_anchor_at_cursor": self.toggle_anchor_at_cursor,
            "add_instance": self.add_instance,
            "center_scene": self.center_scene,
            "delete_selected_instance": self.delete_selected_instance,
        }

    def apply_core_change(self, change: CoreChange) -> None:
        self.refresh_all(change)

    def on_viewport_state_changed(self, message: Optional[str]) -> None:
        self.refresh_all(CoreChange(message=message, redraw=False, refresh_controls=False) if message else None)

    def refresh_all(self, change: Optional[CoreChange] = None) -> None:
        if change and change.message:
            self.last_message = change.message
        self.statusBar().showMessage(self.last_message or "Native shell ready")
        self.viewport.update_from_core(self.core)
        self.left_panel.refresh_from_core(self.core)
        self.right_panel.refresh_from_core(
            self.core,
            grid_enabled=self.viewport.viewer.grid_enabled,
            anchors_enabled=self.viewport.viewer.anchors_enabled,
            bounds_enabled=self.viewport.viewer.envelope_outline_enabled,
            last_message=self.last_message,
        )

    def save_piece(self) -> None:
        self.apply_core_change(self.core.save_current_piece())

    def export_catalog(self) -> None:
        self.apply_core_change(self.core.export_catalog_json())

    def toggle_grid(self) -> None:
        self.viewport.controller.toggle_grid()
        self.refresh_all()

    def toggle_anchor_display(self) -> None:
        self.viewport.controller.toggle_anchor_visibility()
        self.refresh_all()

    def show_project_folder(self) -> None:
        self.refresh_all(CoreChange(message=f"Project folder: {ROOT.parent}", redraw=False, refresh_controls=False))

    def show_about(self) -> None:
        self.refresh_all(CoreChange(message="Python Piece Editor Shell: native menu + embedded 3D viewport.", redraw=False, refresh_controls=False))

    def set_edit_mode(self) -> None:
        self.apply_core_change(self.core.set_edit_mode())

    def set_assembly_mode(self) -> None:
        self.apply_core_change(self.core.set_assembly_mode())

    def on_material_selected(self, value: str) -> None:
        self.apply_core_change(self.core.on_material_selected(value))

    def on_piece_size_selected(self, value: str) -> None:
        self.apply_core_change(self.core.on_piece_size_selected(value))

    def on_variant_selected(self, value: str) -> None:
        self.apply_core_change(self.core.on_variant_selected(value))

    def on_shape_param_selected(self, key: str, value: str) -> None:
        self.apply_core_change(self.core.on_shape_param_selected(key, value))

    def set_variant_render_mode(self) -> None:
        self.apply_core_change(self.core.set_variant_render_mode())

    def set_voxel_render_mode(self) -> None:
        self.apply_core_change(self.core.set_voxel_render_mode())

    def reset_current_shape(self) -> None:
        self.apply_core_change(self.core.reset_current_shape())

    def fill_current_piece(self) -> None:
        self.apply_core_change(self.core.fill_current_piece())

    def clear_current_piece(self) -> None:
        self.apply_core_change(self.core.clear_current_piece())

    def prev_piece(self) -> None:
        self.apply_core_change(self.core.prev_piece())

    def next_piece(self) -> None:
        self.apply_core_change(self.core.next_piece())

    def new_piece(self) -> None:
        self.apply_core_change(self.core.new_piece())

    def toggle_solid_at_cursor(self) -> None:
        self.apply_core_change(self.core.toggle_solid_at_cursor())

    def toggle_anchor_at_cursor(self) -> None:
        self.apply_core_change(self.core.toggle_anchor_at_cursor())

    def add_instance(self) -> None:
        self.apply_core_change(self.core.add_instance())

    def center_scene(self) -> None:
        self.viewport.controller.center_scene()
        self.refresh_all()

    def delete_selected_instance(self) -> None:
        self.apply_core_change(self.core.delete_selected_instance())


def run_native_shell() -> int:
    app = QApplication.instance() or QApplication(sys.argv)
    app.setStyleSheet(build_stylesheet())
    window = PieceEditorWindow()
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(run_native_shell())
