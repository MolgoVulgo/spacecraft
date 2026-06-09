# Known Issues and Regressions

## Active blocking issue

The assembly drag controller is unstable after multiple patches.

Known regressions encountered:

```text
- piece sent far away on Y axis during drag
- piece did not pass above another piece
- piece became stuck and could not detach
- even a single piece stopped moving after further patches
```

The current latest archive should not be trusted as the best base for movement logic. Use a stable version where basic drag/drop works, then reimplement advanced behavior cleanly.

## Root cause

The drag behavior became too intertwined in `src/main.js`.

Current movement concepts mixed together:

```text
free movement
snap grid
side-anchor snap
generic magnetic snap
collision rejection
auto vertical resolve
drag transit collision
attachment validation
mouseup final validation
```

These must be separated.

## Specific problem with desired auto-Z behavior

Desired behavior:

```text
Two pieces side by side.
Drag left piece toward right piece.
1. side anchors should connect first at same Z.
2. pushing further should release side snap.
3. piece should climb by +0.5 in top view.
4. at +0.5 it may be in a temporary transit state and red if not attached.
5. further movement should allow reaching a valid above/on-top position.
```

Existing logic often rejects or bypasses this because collision is treated as final-blocking during drag.

For pieces of height 1:

```text
Z +0.5 still overlaps vertically.
A strict no-collision rule rejects that state.
```

Therefore the controller needs a temporary drag-transit mode distinct from final placement validation.

## Do not patch blindly

Do not keep adding branches inside `tryMoveInstance()` and `applyDragPosition()`.

The movement controller needs a clean result object:

```js
{
  position,
  mode: 'free' | 'side_snap' | 'transit' | 'blocked',
  hasCollision,
  isConnected,
  message
}
```

## Potential stale code to remove from stable branch

Check and remove if present:

```text
localStorage catalog copy code
shape generators inside main.js
old orientation/swap code
solid/voxel divergence not using shape-engine
unbounded anchor snap corrections
drag transit code added late in this conversation if it breaks simple drag
```
