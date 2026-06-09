# Remaining Work

## Priority 1 — Recover stable assembly drag

Start from a stable code version where normal drag/drop works.

Implement these rules first:

```text
1. Single piece must always move on 0.5 grid.
2. No anchor/snap/transit logic may block a single piece.
3. Multiple pieces: free move is allowed if no collision.
4. Collision blocks only after free move and snap attempts fail.
```

No auto-Z until this is locked.

## Priority 2 — Extract drag controller

Create:

```text
src/assembly-drag-controller.js
```

It should expose pure-ish functions that can be unit tested without Three.js pointer events.

Suggested API:

```js
resolveAssemblyDrag({
  movingInstance,
  instances,
  targetPosition,
  dragStartPosition,
  activeView,
  snapStep,
  allowTransit
})
```

Return:

```js
{
  accepted: boolean,
  position: Vector3Like,
  mode: 'free' | 'grid' | 'side_snap' | 'auto_z' | 'transit' | 'blocked',
  visualState: 'normal' | 'selected' | 'invalid',
  reason: string | null
}
```

## Priority 3 — Add movement tests

Add deterministic tests for movement math. Do not rely only on visual testing.

Minimum tests:

```text
single 4x3x1 drag right by 0.5 -> X changes by 0.5
single piece in top/front/side view -> movement axis correct
two 4x3x1 side by side -> side snap at same Z
two 4x3x1 side by side, push beyond contact -> side snap releases
auto-Z top view -> tries Z +0.5 first
auto-Z bottom view -> tries Z -0.5 first
final validation rejects unresolved collision
unconnected piece red; connected pieces normal
```

## Priority 4 — Reintroduce desired auto-Z effect

Desired effect, after stable drag:

```text
side snap first
then push-through releases side snap
then Z +0.5 or Z -0.5 transit
then final validation on mouseup
```

Transit rule:

```text
During drag, temporary vertical partial overlap may be allowed.
On mouseup, final state must be collision-free or rollback/snap to valid position.
```

## Priority 5 — Finish/verify shape variants

Still to refine:

```text
point_1 / pente_1 proportions
point_2 / pente_2 proportions
other game variants from screenshots
shape operation edge cases on height 2 pieces
anchors on non-box / sloped / rounded faces
```

## Priority 6 — Editor save/publish flow

Keep:

```text
Editor publish -> Vite dev endpoint writes public/data/4x3x1_catalog.json
Static build -> export/download JSON
```

Optional future improvement:

```text
SQLite / backend persistence
```

But not required for the next drag refactor.
