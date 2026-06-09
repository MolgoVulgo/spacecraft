# Manual Test Checklist

Run after each movement-related change.

## Load and baseline

```text
[ ] npm install
[ ] npm run dev
[ ] open index.html assembly
[ ] catalog loads from /data/4x3x1_catalog.json
[ ] editor.html remains separate
```

## Add pieces

```text
[ ] select family
[ ] double-click 4x3x1 size -> piece added
[ ] drag-drop 4x3x1 size -> piece added
[ ] 4x3x1 dimensions visible as width 3 / length 4 / height 1
[ ] 6x3x1 and 8x3x1 extend in Y/depth, not X/width
```

## Single piece movement

```text
[ ] single piece moves in top view
[ ] single piece moves in front view
[ ] single piece moves in side view
[ ] snap step is 0.5 on X/Y/Z
[ ] no anchor validation blocks a single piece
```

## Multi-piece movement

```text
[ ] two pieces can be placed side by side
[ ] moving a piece away detaches correctly
[ ] pulling away does not keep sticky side snap
[ ] no coordinate explosion
[ ] no piece disappears
```

## Anchor/connection display

```text
[ ] anchors hidden by default in assembly
[ ] anchor toggle shows/hides red dots
[ ] selected hitbox is blue
[ ] only disconnected/invalid piece is red
[ ] valid connected pieces stay normal/black outline
```

## Desired advanced behavior

```text
[ ] side-anchor snap happens before auto-Z
[ ] pushing beyond side contact releases side snap
[ ] in top view piece climbs by +0.5
[ ] in bottom view piece descends by -0.5
[ ] +0.5 transit state can be red if not anchored
[ ] mouseup validates final state or rolls back
```

## Editor regression checks

```text
[ ] editor still displays voxel 1x1x1 cells
[ ] anchor add by selected face still works
[ ] anchor delete by selected face still works
[ ] round/chamfer still render correctly
[ ] catalog export/publish still works
```
