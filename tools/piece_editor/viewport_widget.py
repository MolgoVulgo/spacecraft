from __future__ import annotations

from typing import Callable, Optional

from PySide6.QtCore import QEvent, QPointF, QTimer, Qt
from PySide6.QtWidgets import QVBoxLayout, QWidget
from panda3d.core import WindowProperties
from ursina import Ursina, camera, mouse, window
from ursina.scene import instance as scene

from .core import PieceEditorCore
from .grid import build_grid
from .runtime import ViewportController, ViewportInputBridge, disable_ursina_dev_widgets, set_default_camera_pose
from .theme import THEME
from .ursina_theme import apply_window_theme, ursina_theme
from .viewer import EditorViewer

URSINA_THEME = ursina_theme()


class ViewportWidget(QWidget):
    def __init__(
        self,
        core: PieceEditorCore,
        on_state_changed: Optional[Callable[[Optional[str]], None]] = None,
        parent: Optional[QWidget] = None,
    ) -> None:
        super().__init__(parent)
        self.core = core
        self.on_state_changed = on_state_changed
        self.right_drag_last_pos: Optional[QPointF] = None
        self.middle_drag_last_pos: Optional[QPointF] = None
        self.left_drag_active = False

        self.container = QWidget(self)
        self.container.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        self.container.setAttribute(Qt.WidgetAttribute.WA_NativeWindow, True)
        self.container.setAttribute(Qt.WidgetAttribute.WA_DontCreateNativeAncestors, True)
        self.container.setMouseTracking(True)
        self.container.installEventFilter(self)
        self.setFocusProxy(self.container)

        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        layout.addWidget(self.container)
        self.setLayout(layout)

        self.app = Ursina(
            title="Python Piece Editor",
            borderless=False,
            fullscreen=False,
            development_mode=False,
            editor_ui_enabled=False,
            window_type="none",
            size=(960, 720),
        )
        apply_window_theme(self.app)
        self._open_embedded_window()
        disable_ursina_dev_widgets()
        set_default_camera_pose()

        self.viewer = EditorViewer(build_grid(size=32, line_color=URSINA_THEME["grid_line"]))
        self.viewer.setup_default_lights()
        self.controller = ViewportController(core, self.viewer, on_state_changed=self.on_state_changed)
        self.input_bridge = ViewportInputBridge(self.controller)

        self.timer = QTimer(self)
        self.timer.timeout.connect(self._step_renderer)
        self.timer.start(16)

        self.controller.redraw()
        self.controller.center_scene(announce=False)
        self._sync_window_size()

    def focus_viewport(self) -> None:
        self.container.setFocus(Qt.FocusReason.OtherFocusReason)

    def _pointer_tuple(self, event) -> tuple[float, float, float, float]:  # noqa: ANN001
        pos = event.position()
        return (pos.x(), pos.y(), float(self.container.width()), float(self.container.height()))

    def _open_embedded_window(self) -> None:
        props = WindowProperties()
        props.setParentWindow(int(self.container.winId()))
        props.setOrigin(0, 0)
        props.setSize(max(self.container.width(), 1), max(self.container.height(), 1))
        self.app.openMainWindow(props=props, keepCamera=False, type="onscreen")

        camera._cam = self.app.camera
        camera._cam.reparent_to(camera)
        camera.render = self.app.render
        scene.camera = camera
        camera._set_up()

        self.app.buttonThrowers[0].node().setButtonDownEvent("buttonDown")
        self.app.buttonThrowers[0].node().setButtonUpEvent("buttonUp")
        self.app.buttonThrowers[0].node().setButtonRepeatEvent("buttonHold")
        self.app.buttonThrowers[0].node().setKeystrokeEvent("keystroke")
        mouse._mouse_watcher = self.app.mouseWatcherNode
        self._update_camera_aspect_ratio()

    def _step_renderer(self) -> None:
        self.app.step()

    def _update_camera_aspect_ratio(self) -> None:
        width = max(self.container.width(), 1)
        height = max(self.container.height(), 1)
        aspect_ratio = width / height
        if hasattr(camera, "perspective_lens"):
            camera.perspective_lens.set_aspect_ratio(aspect_ratio)
        if hasattr(camera, "ui_lens"):
            camera.ui_lens.set_film_size(camera._ui_size * 0.5 * aspect_ratio, camera._ui_size * 0.5)
        if getattr(camera, "orthographic", False) and hasattr(camera, "orthographic_lens"):
            camera.orthographic_lens.set_film_size(camera.fov * aspect_ratio, camera.fov)

    def _sync_window_size(self) -> None:
        if not getattr(self, "container", None):
            return
        request_properties = getattr(self.app.win, "requestProperties", None)
        if request_properties is None:
            request_properties = getattr(self.app.win, "request_properties", None)
        if request_properties is None:
            return
        from panda3d.core import WindowProperties

        props = WindowProperties()
        props.setParentWindow(int(self.container.winId()))
        props.setSize(max(self.container.width(), 1), max(self.container.height(), 1))
        request_properties(props)
        self._update_camera_aspect_ratio()

    def resizeEvent(self, event) -> None:  # noqa: ANN001 - Qt callback signature
        super().resizeEvent(event)
        self._sync_window_size()

    def closeEvent(self, event) -> None:  # noqa: ANN001 - Qt callback signature
        self.timer.stop()
        super().closeEvent(event)

    def eventFilter(self, watched, event) -> bool:  # noqa: ANN001 - Qt callback signature
        if watched is not self.container:
            return super().eventFilter(watched, event)

        event_type = event.type()
        if event_type == QEvent.Type.Wheel:
            delta = event.angleDelta().y()
            if delta:
                self.controller.zoom_camera(1 if delta > 0 else -1)
            return True

        if event_type == QEvent.Type.MouseButtonPress:
            self.focus_viewport()
            if event.button() == Qt.MouseButton.LeftButton:
                self.left_drag_active = True
                self.controller.begin_mouse_drag(self._pointer_tuple(event))
                return True
            if event.button() == Qt.MouseButton.RightButton:
                self.right_drag_last_pos = event.position()
                return True
            if event.button() == Qt.MouseButton.MiddleButton:
                self.middle_drag_last_pos = event.position()
                return True

        if event_type == QEvent.Type.MouseMove:
            if self.left_drag_active:
                self.controller.update_drag(self._pointer_tuple(event))
                return True
            if self.right_drag_last_pos is not None:
                current_pos = event.position()
                delta = current_pos - self.right_drag_last_pos
                self.viewer.orbit_camera(delta_yaw=delta.x() * 0.35, delta_pitch=delta.y() * 0.25)
                self.right_drag_last_pos = current_pos
                return True
            if self.middle_drag_last_pos is not None:
                current_pos = event.position()
                delta = current_pos - self.middle_drag_last_pos
                self.viewer.pan_camera(delta_x=delta.x(), delta_y=delta.y())
                self.middle_drag_last_pos = current_pos
                return True

        if event_type == QEvent.Type.MouseButtonRelease:
            if event.button() == Qt.MouseButton.LeftButton:
                self.left_drag_active = False
                self.controller.end_mouse_drag()
                return True
            if event.button() == Qt.MouseButton.RightButton:
                self.right_drag_last_pos = None
                return True
            if event.button() == Qt.MouseButton.MiddleButton:
                self.middle_drag_last_pos = None
                return True

        return super().eventFilter(watched, event)

    def update_from_core(self, core: Optional[PieceEditorCore] = None) -> None:
        if core is not None:
            self.core = core
            self.controller.core = core
        self.controller.redraw()

    def draw_edit_piece(self, piece, cursor) -> None:  # noqa: ANN001 - façade method
        self.viewer.draw_edit_piece(piece, cursor)

    def draw_assembly(self, instances, selected_instance_index) -> None:  # noqa: ANN001 - façade method
        self.viewer.draw_assembly(instances, selected_instance_index)

    def set_grid_enabled(self, enabled: bool) -> None:
        self.viewer.set_grid_enabled(enabled)

    def set_anchors_enabled(self, enabled: bool) -> None:
        self.viewer.set_anchors_enabled(enabled)
        self.controller.redraw()

    def center_scene(self, center, size) -> None:  # noqa: ANN001 - façade method
        self.viewer.center_scene(center, size)
