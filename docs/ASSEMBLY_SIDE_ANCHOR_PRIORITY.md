# Assembly Side Anchor Priority

## Current rule

During piece drag, lateral anchor snap has priority over automatic vertical resolution.

Order:

1. Compute the drag target from the drag start position plus pointer delta.
2. Snap the target to the 0.5 grid.
3. Try same-height side-anchor snap.
4. If no valid side-anchor snap exists, try automatic vertical resolution in top/bottom views.
5. Validate collision and attachment state.

## Stability constraints

Side-anchor snap is deterministic and bounded:

- every drag frame is recalculated from `dragStartPosition + pointerDelta`, not from the previous corrected position;
- the side snap may correct only the contact axis and a small tangent drift;
- candidates with non-finite coordinates are rejected;
- candidates outside `DRAG_WORLD_LIMIT` are rejected;
- candidates too far from the current drag target are rejected;
- automatic vertical resolution is a fallback, not the primary collision response.

## Example

Two 4x3x1 pieces side by side:

```txt
left  piece: -300, 400, 0
right piece:    0, 400, 0
```

Dragging the left piece toward the right first tries to preserve the same-Z side attachment. It must not jump on Y or teleport outside the scene. If the side snap is no longer valid, the auto-Z fallback may attempt to move the piece above or below depending on the current view.

## Anti-sticking rule

Side-anchor snap must only hold while the dragged target remains close to the side contact position.

With the current 0.5 catalog-unit step:

```txt
step = 50 world units
side snap hold distance = step * 0.49
```

This means:

- at the side contact position, the part magnetizes normally;
- once the user drags one half-step into the neighbouring part, side snap releases;
- the collision is then handled by the auto-Z resolver in top/bottom views.

This prevents the side snap from pinning the part forever and blocking the intended “pass above / below” behaviour.
