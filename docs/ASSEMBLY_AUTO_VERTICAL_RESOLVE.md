# Assembly — Automatic Vertical Collision Resolve

## Purpose

When a piece is dragged in assembly view, horizontal movement must not be blocked immediately by another piece on the same layer.

If the dragged piece collides with another piece, the assembly view tries to resolve the collision on the vertical axis using the same 0.5 unit snap as X/Y placement.

## Rules

- X = width.
- Y = depth / length.
- Z = height.
- Snap step = 0.5 catalog unit.
- One catalog unit currently equals `mesh_unit_scale` world units.
- Drag in top view resolves collision upward.
- Drag in bottom view resolves collision downward.
- Front and side views do not auto-resolve Z; collision remains blocking there.
- If no free vertical position is found, the movement is refused.
- If a free position is found but no compatible anchor connects the piece to the root assembly graph, the piece remains placed but receives the red invalid contour.

## Behaviour

```txt
drag X/Y
→ snap X/Y/Z to 0.5 unit
→ test direct position
→ if no collision: move
→ if collision and view is top/bottom: test Z ±0.5, ±1.0, ±1.5, ...
→ first non-colliding position is accepted
→ anchor graph validation runs after placement
```

## Separation of concerns

```txt
collision = physical overlap, blocking if unresolved
anchor graph = structural validity, red contour if disconnected
selection = blue hitbox contour
```

This preserves manual control while making horizontal assembly less rigid.
