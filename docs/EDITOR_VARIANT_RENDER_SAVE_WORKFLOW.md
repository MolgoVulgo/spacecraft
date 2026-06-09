# Editor variant rendering and save workflow

## Scope

This iteration fixes four editor issues:

1. Existing rounded/chamfered variants must not render as plain square voxel blocks only.
2. On parts with height `2`, a round/chamfer operation selected from the top or bottom corner must affect the full vertical column, not only one 1x1x1 cell.
3. Shape corrections must update the preview immediately.
4. Saving must follow a clear `draft -> checked -> validated` workflow.

## Rendering behavior

The editor still displays the part as a 1x1x1 voxel structure, but shape corrections are now rendered as visible geometry:

- `round` uses radius `1.0`.
- `chamfer` uses size `0.5`.
- legacy rounded/chamfered shapes are migrated to `voxel_grid` with explicit `generation.operations`.
- affected cells are hidden and replaced by correction geometry so the user no longer sees only square blocks.

The geometry remains an editor preview approximation. The JSON operation is the source of truth.

## Operation scope

Face operations are derived from the selected voxel face.

For a top/bottom corner on a part with height `2`, the operation stores all vertical cells in `scope.cells`:

```json
"scope": {
  "kind": "corner",
  "vertical_span": true,
  "cells": [
    { "x": 0, "y": 0, "z": 0 },
    { "x": 0, "y": 0, "z": 1 }
  ]
}
```

This avoids applying a round/chamfer to only one layer of a two-layer part.

## Dynamic preview

Every shape edit calls `renderAll()` and rebuilds the Three.js preview immediately:

- add/remove cell
- add/remove anchor
- add/remove round/chamfer correction
- identity update

When a previously checked or validated shape is modified, its status is automatically reset to `draft`.

## Save workflow

The editor now exposes three explicit actions:

- `Enregistrer brouillon`: saves the current catalog in browser local storage and marks the selected variant as `draft`.
- `Contrôler variante`: runs checks on the selected variant. If there are no blocking errors, status becomes `checked`.
- `Valider variante`: runs checks again and sets status to `validated` if valid.

Browser storage is not a project file write. The durable project update is still done through `Exporter catalogue`, then replacing `public/data/4x3x1_catalog.json`.
