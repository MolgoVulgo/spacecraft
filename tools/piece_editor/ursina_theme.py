from __future__ import annotations

from typing import Any, Dict

from panda3d.core import Vec4
from ursina import color, window

from .theme import THEME


def ursina_theme() -> Dict[str, object]:
    return {
        "grid_line": color.rgb32(*THEME["grid_line"]),
        "scene_clear": color.rgb32(*THEME["scene_clear"]),
        "anchor": color.rgb32(*THEME["anchor"]),
    }


def apply_window_theme(base: Any) -> None:
    colors = ursina_theme()
    window.color = colors["scene_clear"]
    try:
        r, g, b = THEME["scene_clear"]
        base.win.setClearColor(Vec4(r / 255.0, g / 255.0, b / 255.0, 1.0))
    except Exception:
        pass
