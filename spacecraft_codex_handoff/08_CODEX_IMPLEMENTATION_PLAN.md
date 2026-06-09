# Codex Implementation Plan

## Phase 0 — Start from stable code

Use the last stable archive where:

```text
- piece drag/drop works
- piece movement works
- no auto-Z regressions
```

Do not start from the latest unstable drag-transit version unless you only use it for reference.

## Phase 1 — Sanity cleanup

Verify and enforce:

```text
- no localStorage catalog copy
- assembly reads /data/4x3x1_catalog.json only
- shape-engine is the only shape generator
- main.js does not generate geometry directly
- X/Y/Z convention is consistent
```

## Phase 2 — Extract movement controller

Create:

```text
src/assembly-drag-controller.js
```

Move only movement decision logic there. Keep Three.js DOM pointer code in `main.js`.

Suggested split:

```text
main.js:
  pointer events
  raycast
  selected instance
  apply result to scene

assembly-drag-controller.js:
  grid snap
  collision candidate checks
  side-anchor snap decisions
  auto-Z decisions
  transit state decisions
```

## Phase 3 — Restore basic movement tests

Before auto-Z, test:

```text
- single piece moves in all views
- multi-piece free movement works when no collision
- collision blocks when no resolution allowed
```

## Phase 4 — Side-anchor snap

Implement side anchor snap alone.

Accept criteria:

```text
- two 4x3x1 pieces snap side by side at same Z
- moving away detaches immediately
- no huge coordinate jumps
- no sticky behavior when pulling away
```

## Phase 5 — Auto-Z fallback

Implement auto-Z only after side snap fails/releases.

Accept criteria:

```text
- top view pushes upward in Z
- bottom view pushes downward in Z
- front/side do not auto-Z unless explicitly enabled later
```

## Phase 6 — Transit state

Implement temporary half-step transit.

Accept criteria:

```text
- at Z +0.5 piece can be shown during drag
- invalid state appears red if not anchored
- mouseup resolves to valid position or rollback
```

## Phase 7 — Regression lock

Add/keep a markdown test checklist for manual validation:

```text
1. Add one 4x3x1.
2. Drag in top view.
3. Drag in front view.
4. Drag in side view.
5. Add second 4x3x1 side by side.
6. Pull away: detaches.
7. Push into neighbor: side snap first.
8. Push farther: auto-Z transition.
9. Release on invalid: rollback or final snap.
10. Only invalid piece red.
```
