from __future__ import annotations

from ursina import Entity, color


def build_grid(size: int = 32, step: int = 1, line_color=None) -> Entity:
    """Build a floor grid.

    Logical coordinates: x = length, y = width, z = height.
    Scene coordinates: X = length, Z = width, Y = height.
    """
    parent = Entity(name="grid")
    half = size // 2
    line_color = line_color or color.rgb32(74, 79, 88)

    for i in range(-half, half + 1, step):
        thickness = 0.010 if i else 0.020
        Entity(
            parent=parent,
            model="cube",
            color=line_color,
            position=(0, -0.025, i),
            scale=(size, thickness, thickness),
        )
        Entity(
            parent=parent,
            model="cube",
            color=line_color,
            position=(i, -0.025, 0),
            scale=(thickness, thickness, size),
        )
    return parent
