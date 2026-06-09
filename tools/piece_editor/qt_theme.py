from __future__ import annotations

from .theme import THEME


def build_stylesheet() -> str:
    return f"""
QMainWindow, QWidget {{
    background-color: {THEME["panel_bg"]};
    color: {THEME["menu_text"]};
    font-size: 13px;
}}
QMenuBar {{
    background-color: {THEME["panel_bg"]};
    color: {THEME["menu_text"]};
}}
QMenuBar::item:selected, QMenu::item:selected {{
    background-color: {THEME["button_active"]};
}}
QMenu {{
    background-color: {THEME["panel_alt"]};
    color: {THEME["menu_text"]};
    border: 1px solid {THEME["border"]};
}}
QGroupBox {{
    border: 1px solid {THEME["border"]};
    margin-top: 8px;
    padding-top: 8px;
    font-weight: 600;
}}
QGroupBox::title {{
    subcontrol-origin: margin;
    left: 8px;
    padding: 0 4px;
}}
QPushButton, QComboBox {{
    background-color: {THEME["button"]};
    color: {THEME["menu_text"]};
    border: 1px solid {THEME["border"]};
    min-height: 24px;
    padding: 2px 8px;
}}
QPushButton:checked {{
    background-color: {THEME["button_active"]};
}}
QPushButton:hover, QComboBox:hover {{
    background-color: {THEME["button_highlight"]};
}}
QPushButton:pressed {{
    background-color: {THEME["button_pressed"]};
}}
QComboBox QAbstractItemView {{
    background-color: {THEME["panel_alt"]};
    color: {THEME["menu_text"]};
    selection-background-color: {THEME["button_active"]};
}}
QStatusBar {{
    background-color: {THEME["panel_alt"]};
    color: {THEME["menu_text_muted"]};
}}
QDockWidget {{
    color: {THEME["menu_text"]};
}}
QDockWidget::title {{
    background-color: {THEME["panel_alt"]};
    text-align: left;
    padding: 6px 8px;
}}
"""
