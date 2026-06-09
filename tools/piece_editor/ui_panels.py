from __future__ import annotations

from typing import Callable, Dict, List, Optional

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QComboBox,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QVBoxLayout,
    QLayout,
    QWidget,
)


def _group(title: str, content) -> QGroupBox:
    box = QGroupBox(title)
    if isinstance(content, QLayout):
        box.setLayout(content)
    else:
        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(content)
        box.setLayout(layout)
    return box


class LeftControlPanel(QWidget):
    def __init__(self, callbacks: Dict[str, Callable], parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self.callbacks = callbacks
        self.material_combo = QComboBox()
        self.piece_size_combo = QComboBox()
        self.variant_combo = QComboBox()
        self.edit_mode_button: Optional[QPushButton] = None
        self.assembly_mode_button: Optional[QPushButton] = None
        self.variant_render_button: Optional[QPushButton] = None
        self.voxel_render_button: Optional[QPushButton] = None
        self.shape_rows: List[tuple[str, QComboBox]] = []
        self.shape_container = QWidget()
        self.shape_layout = QFormLayout()
        self.shape_container.setLayout(self.shape_layout)
        self._build()

    def _button(self, label: str, callback: Callable) -> QPushButton:
        button = QPushButton(label)
        button.clicked.connect(callback)
        return button

    @staticmethod
    def _toggle_button(button: QPushButton, active: bool) -> None:
        button.setCheckable(True)
        button.setChecked(active)

    def _build(self) -> None:
        root = QVBoxLayout()
        root.setContentsMargins(8, 8, 8, 8)
        root.setSpacing(8)

        mode_layout = QHBoxLayout()
        self.edit_mode_button = self._button("Edit", self.callbacks["set_edit_mode"])
        self.assembly_mode_button = self._button("Assembly", self.callbacks["set_assembly_mode"])
        mode_layout.addWidget(self.edit_mode_button)
        mode_layout.addWidget(self.assembly_mode_button)
        root.addWidget(_group("Mode", mode_layout))

        catalog_layout = QFormLayout()
        self.material_combo.currentTextChanged.connect(self.callbacks["on_material_selected"])
        self.piece_size_combo.currentTextChanged.connect(self.callbacks["on_piece_size_selected"])
        self.variant_combo.currentTextChanged.connect(self.callbacks["on_variant_selected"])
        catalog_layout.addRow("Material", self.material_combo)
        catalog_layout.addRow("Base size", self.piece_size_combo)
        catalog_layout.addRow("Variant", self.variant_combo)
        root.addWidget(_group("Catalog", catalog_layout))

        shape_layout = QVBoxLayout()
        render_buttons = QHBoxLayout()
        self.variant_render_button = self._button("Variant", self.callbacks["set_variant_render_mode"])
        self.voxel_render_button = self._button("Voxel", self.callbacks["set_voxel_render_mode"])
        render_buttons.addWidget(self.variant_render_button)
        render_buttons.addWidget(self.voxel_render_button)
        shape_layout.addLayout(render_buttons)
        shape_layout.addWidget(self.shape_container)
        root.addWidget(_group("Shape", shape_layout))

        edit_layout = QVBoxLayout()
        for label, key in (
            ("Reset variant", "reset_current_shape"),
            ("Fill volume", "fill_current_piece"),
            ("Clear volume", "clear_current_piece"),
            ("Prev piece", "prev_piece"),
            ("Next piece", "next_piece"),
            ("New piece", "new_piece"),
            ("Save piece", "save_current_piece"),
            ("Toggle solid", "toggle_solid_at_cursor"),
            ("Toggle anchor point", "toggle_anchor_at_cursor"),
        ):
            edit_layout.addWidget(self._button(label, self.callbacks[key]))
        root.addWidget(_group("Edit Piece", edit_layout))

        assembly_layout = QVBoxLayout()
        for label, key in (
            ("Add instance", "add_instance"),
            ("Center scene", "center_scene"),
            ("Delete selected", "delete_selected_instance"),
        ):
            assembly_layout.addWidget(self._button(label, self.callbacks[key]))
        root.addWidget(_group("Assembly", assembly_layout))
        root.addStretch(1)
        self.setLayout(root)

    def refresh(self, material_options: List[str], selected_material: str, piece_options: List[str], selected_piece: str, variant_options: List[str], selected_variant: str) -> None:
        self._set_combo_items(self.material_combo, material_options, selected_material)
        self._set_combo_items(self.piece_size_combo, piece_options, selected_piece)
        self._set_combo_items(self.variant_combo, variant_options, selected_variant)

    def refresh_from_core(self, core) -> None:  # noqa: ANN001 - app shell passes PieceEditorCore
        current_piece = core.get_current_piece()
        self.refresh(
            material_options=core.get_material_options(),
            selected_material=current_piece.material,
            piece_options=core.get_piece_size_options(),
            selected_piece="x".join(map(str, current_piece.base_size)),
            variant_options=core.get_variant_options(),
            selected_variant=core.get_selected_variant_label(),
        )
        self.refresh_shape_params(core.get_shape_param_specs(), self.callbacks["on_shape_param_selected"])
        if self.edit_mode_button is not None:
            self._toggle_button(self.edit_mode_button, core.get_mode() == "edit")
        if self.assembly_mode_button is not None:
            self._toggle_button(self.assembly_mode_button, core.get_mode() == "assembly")
        if self.variant_render_button is not None:
            self._toggle_button(self.variant_render_button, core.get_render_mode() == "variant")
        if self.voxel_render_button is not None:
            self._toggle_button(self.voxel_render_button, core.get_render_mode() == "voxel")

    def refresh_shape_params(self, param_specs: List[dict], on_change: Callable[[str, str], None]) -> None:
        while self.shape_layout.rowCount():
            self.shape_layout.removeRow(0)
        self.shape_rows = []
        for spec in param_specs:
            combo = QComboBox()
            self._set_combo_items(combo, list(spec["options"]), str(spec["value"]))
            key = str(spec["key"])
            combo.currentTextChanged.connect(lambda value, item_key=key: on_change(item_key, value))
            self.shape_layout.addRow(str(spec["label"]), combo)
            self.shape_rows.append((key, combo))

    @staticmethod
    def _set_combo_items(combo: QComboBox, items: List[str], selected: str) -> None:
        combo.blockSignals(True)
        combo.clear()
        combo.addItems(items)
        index = combo.findText(selected)
        combo.setCurrentIndex(index if index >= 0 else 0)
        combo.blockSignals(False)


class RightInspectorPanel(QWidget):
    def __init__(self, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self.message_label = QLabel("-")
        self.mode_value = QLabel("-")
        self.current_piece_form = QFormLayout()
        self.selected_instance_form = QFormLayout()
        self.cursor_form = QFormLayout()
        self.render_form = QFormLayout()
        self.specs_form = QFormLayout()
        self._build()

    def _build(self) -> None:
        root = QVBoxLayout()
        root.setContentsMargins(8, 8, 8, 8)
        root.setSpacing(8)

        mode_layout = QFormLayout()
        mode_layout.addRow("Mode", self.mode_value)
        root.addWidget(_group("Mode", mode_layout))
        root.addWidget(_group("Current piece", self._wrap_form(self.current_piece_form)))
        root.addWidget(_group("Selected instance", self._wrap_form(self.selected_instance_form)))
        root.addWidget(_group("Cursor", self._wrap_form(self.cursor_form)))
        root.addWidget(_group("Render flags", self._wrap_form(self.render_form)))
        root.addWidget(_group("Specs", self._wrap_form(self.specs_form)))

        message_box = QVBoxLayout()
        self.message_label.setWordWrap(True)
        self.message_label.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)
        message_box.addWidget(self.message_label)
        root.addWidget(_group("Messages / last operation", message_box))
        root.addStretch(1)
        self.setLayout(root)

    @staticmethod
    def _wrap_form(form: QFormLayout) -> QWidget:
        widget = QWidget()
        widget.setLayout(form)
        return widget

    @staticmethod
    def _populate_form(form: QFormLayout, rows: List[tuple[str, str]]) -> None:
        while form.rowCount():
            form.removeRow(0)
        for label, value in rows:
            form.addRow(label, QLabel(value))

    def refresh(self, status_model: Dict[str, object], grid_enabled: bool, anchors_enabled: bool, bounds_enabled: bool, last_message: str) -> None:
        current_piece = status_model["current_piece"]
        selected = status_model["selected_instance"]
        self.mode_value.setText(str(status_model["mode"]))
        self._populate_form(
            self.current_piece_form,
            [
                ("Name", str(current_piece["name"])),
                ("Material", str(current_piece["material"])),
                ("Base size", "x".join(map(str, current_piece["base_size"]))),
                ("Variant", str(current_piece["variant"])),
            ],
        )
        self._populate_form(
            self.selected_instance_form,
            [
                ("Selected", f"#{selected['id']} {selected['piece_name']}" if selected else "none"),
                ("Position", str(selected["position"]) if selected else "-"),
                ("Mirrors", str(selected["mirrors"]) if selected else "-"),
            ],
        )
        self._populate_form(
            self.cursor_form,
            [
                ("Cursor", str(current_piece["cursor"])),
                ("Solid", "yes" if current_piece["cursor_solid"] else "no"),
                ("Anchor", "yes" if current_piece["cursor_anchor"] else "no"),
            ],
        )
        self._populate_form(
            self.render_form,
            [
                ("Render", str(current_piece["render_mode"])),
                ("Grid", "on" if grid_enabled else "off"),
                ("Anchors", "on" if anchors_enabled else "off"),
                ("Bounds", "on" if bounds_enabled else "off"),
            ],
        )
        specs_source = selected["specs"] if selected else current_piece["specs"]
        self._populate_form(
            self.specs_form,
            [
                (spec["label"], f"{spec['value']} {spec['unit']}".strip() if spec["value"] != "" else "-")
                for spec in specs_source.values()
            ],
        )
        self.message_label.setText(last_message or "-")

    def refresh_from_core(self, core, grid_enabled: bool, anchors_enabled: bool, bounds_enabled: bool, last_message: str) -> None:  # noqa: ANN001
        self.refresh(core.get_status_model(), grid_enabled, anchors_enabled, bounds_enabled, last_message)
