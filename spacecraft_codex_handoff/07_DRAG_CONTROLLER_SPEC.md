# Assembly Drag Controller Specification

This is the key spec for the next development phase.

## Coordinate system

```text
X = width
Y = depth / length
Z = height
```

Grid step:

```text
catalog step = 0.5
world step = 50 when scale = 100
```

## Basic movement guarantees

### Single piece

A single piece must always move freely on the snap grid.

Rules:

```text
- no side-anchor snap
- no generic magnetic snap
- no auto-Z
- no attachment validation error
- no collision possible
```

### Multiple pieces

For multiple pieces:

```text
1. compute raw target from pointer and active view plane
2. snap target to 0.5 grid
3. if no collision: apply target
4. if near side anchors: apply side snap
5. if collision remains and active view allows it: try auto-Z
6. if transit allowed during drag: allow temporary half-step state
7. final mouseup validation must be strict
```

## Drag planes

```text
top view:
  plane XY, Z fixed

front view:
  plane XZ, Y fixed

side view:
  plane YZ, X fixed
```

## Side-anchor snap

Side snap must happen before auto-Z.

Side snap rules:

```text
- only lateral faces, not top/bottom
- normals must be opposed
- anchors must align on the contact plane
- correction must be bounded
- never produce NaN/Infinity
- never move a piece by huge unintended values
```

Guardrails:

```text
if abs(delta tangent) > one snap step or configured limit:
  reject candidate

if abs(delta any axis) > world safety limit:
  reject candidate
```

## Push-through behavior

When a piece is side-snapped and the user pushes further into the neighboring piece:

```text
1. keep side snap for small movement near contact
2. release side snap after push threshold
3. trigger auto-Z/transit only after side snap releases
```

Suggested threshold:

```text
pushThroughThreshold = 0.5 catalog unit
```

## Auto-Z

Auto-Z direction by view:

```text
top    -> Z+
bottom -> Z-
front/side -> no implicit auto-Z by default
```

Auto-Z should test increments:

```text
Z ±0.5
Z ±1.0
Z ±1.5
...
```

## Transit mode

The user explicitly wants a temporary state where a piece can be at `Z +0.5` or `Z -0.5` even if it partially overlaps vertically during drag.

Rules:

```text
- transit allowed only during active drag
- transit state should show invalid/red if not connected by anchors
- final mouseup must validate strictly
```

Mouseup behavior options:

```text
A. snap to nearest valid non-colliding position
B. rollback to last valid position
C. keep invalid red only if non-collision but unanchored
```

Recommended:

```text
If still collisioning on mouseup, try final auto-Z to nearest non-collision position.
If impossible, rollback to last valid position.
```

## Validation states

```text
normal: connected or single/root piece
selected: blue outline
invalid: red outline, only for pieces not connected to main anchor graph
blocked: movement refused, do not move
```

Do not color all pieces red. Only non-connected pieces should be red.

## Implementation rule

Do not bury this logic inside generic `tryMoveInstance()`.

Use explicit controller result:

```js
const result = resolveAssemblyDrag(...);
applyDragResult(result);
```
