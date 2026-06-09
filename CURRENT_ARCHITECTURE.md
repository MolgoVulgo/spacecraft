# CURRENT_ARCHITECTURE.md

## SpaceCraft C1 checkpoint

This file is the current technical checkpoint for the SpaceCraft local web application. It must be used as the reference before modifying the project further.

## Product split

The project contains two separate applications.

```text
index.html   -> Assembly, public ship builder
editor.html  -> Editor, internal catalog/piece/variant/spec/recipe tool
```

Assembly must never expose catalog editing controls. Editor must never behave as the public ship builder.

## Runtime stack

```text
Vite
Three.js
JavaScript modules
Rich JSON catalog
```

Python/Ursina/Panda3D code under `tools/` is legacy/reference material only. It is not the active runtime.

## Catalog source of truth

The only active catalog file is:

```text
public/data/4x3x1_catalog.json
```

The built copy is:

```text
dist/data/4x3x1_catalog.json
```

Rules:

```text
- Do not use localStorage for catalog persistence.
- Do not keep an Assembly-specific catalog copy in browser storage.
- Editor publish writes the catalog file in dev through the Vite endpoint.
- Static build fallback may download/export JSON if direct write is impossible.
- Assembly reads /data/4x3x1_catalog.json only.
```

If `public/data/4x3x1_catalog.json` is absent in dev, Editor and Assembly must not silently load stale data.

## Rich catalog model

The flat legacy model is forbidden.

Required top-level structure:

```text
schema_version
game
units
definitions
sizes
families
shape_variants
spec_profiles
recipes
catalog_pieces
ship_blueprint_schema
```

A playable catalog entry is:

```text
family + size + shape_variant + spec_profile + recipe
```

Do not merge these concepts:

```text
size              -> fixed game dimensions
shape_variant     -> geometry / silhouette
symmetry_state     -> instance transform
spec_profile       -> stats
recipe             -> crafting data
placed_piece        -> ship instance
```

## Fixed dimensions rule

Every game piece keeps its catalog dimensions regardless of visible shape variant.

Example:

```text
4x3x1 remains logically 4x3x1 even if half the volume is empty/transparent because of a point or slope variant.
```

Reserved volume, collision box, snap, and anchor compatibility must use the fixed catalog dimensions unless a later explicit rule says otherwise.

## Axis convention

The project-level geometry convention is:

```text
X = width / largeur
Y = depth / length / profondeur-longueur
Z = height / hauteur
```

This convention is shared by Assembly and Editor.

Assembly scene rules:

```text
- grid plane = XY
- grid normal = Z
- top view camera = +Z looking toward -Z
- front view camera = looking along Y
- side view camera = looking along X
```

There must be no hidden final axis swap after geometry generation.

## Shape engine

The only active geometry generator is:

```text
src/shape-engine.js
```

Assembly and Editor must use the same engine.

```text
Editor   -> buildShapeGeometry(..., showVoxels: true)
Assembly -> buildShapeGeometry(..., showVoxels: false)
```

`src/main.js` must not contain shape generators. It may only request generated geometry from `src/shape-engine.js` and handle Assembly interaction/state.

Forbidden in `src/main.js`:

```text
getBoxMesh
getWedgeMesh
buildPrimitiveGeometry
buildParametricGeometry
buildFallbackBoxGeometry
legacy mesh reconstruction logic
```

## Rendering modes

Editor rendering:

```text
- voxel/cell display enabled
- visible 1x1x1 cells
- internal cell edges visible
- anchors visible for editing
- face selection enabled
```

Assembly rendering:

```text
- unified solid piece display
- no voxel separation
- no internal face/cell edges
- exterior/durable edges only
- anchors hidden by default
- anchor visibility controlled by a button
```

Current Assembly selected hitbox color:

```text
THEME_COLORS.selectionHitbox = blue
```

This must stay theme-variable, not hardcoded inline.

## Variant geometry rules

Local face operations:

```text
round/chamfer are not added volumes
round/chamfer replace the affected corner/edge section
```

Round:

```text
radius = 1
section = 90 degree arc
2 planar sides remain normal
```

Chamfer:

```text
offset = 0.5
section = 45 degree flat cut
2 planar sides remain normal
```

Global point/slope variants:

```text
point_1 / pente_1 -> side-directed point, never center-directed
point_2 / pente_2 -> side-directed point, never center-directed
point_3 / pente_3 -> current asymmetric triangular point is acceptable
```

Cosmetic details are ignored:

```text
panels
screws
reliefs
surface decorative grooves
small decals
```

Only functional external silhouette matters.

## Assembly interaction model

Left panel behavior:

```text
Family/material selector -> chooses material family
Size list               -> draggable/double-clickable source of new placed pieces
Shape palette           -> modifies the selected placed piece, does not create a new piece
```

Rules:

```text
- double click on a size adds a piece to the scene
- drag/drop a size adds a piece to the scene
- clicking a shape applies that shape variant to the selected placed piece
- profile selector is not required in Assembly unless later specs force it
```

## Placement, snap, anchors

Snap step:

```text
0.5 catalog unit on X, Y, and Z
```

With current scale:

```text
1 catalog unit = 100 scene units
0.5 catalog unit = 50 scene units
```

Piece movement must snap on all axes, including height.

Anchor rule:

```text
A piece is valid if it is the first piece or if it is connected to the main connected group through at least one compatible anchor pair.
```

Compatibility requires:

```text
- exposed faces in contact
- matching anchor positions
- opposite normals
- no collision overlap
```

Error display:

```text
- only disconnected/invalid pieces get a red contour
- valid pieces keep normal exterior contour
- selected piece has blue hitbox contour
```

## Build commands

```bash
npm install
npm run dev
npm run build
npm run build:assembly
```

`npm run build:assembly` is the public distribution build and must not expose `editor.html`.

## Current known priorities

The current stable checkpoint includes:

```text
- rich catalog structure
- editor/assembly split
- no browser localStorage catalog copy
- unified shape-engine entry point
- fixed dimensions rule
- Assembly solid rendering
- Editor voxel rendering
- XY grid / Z height model
- anchor display toggle in Assembly
- snap step 0.5 on X/Y/Z
- red contour only on invalid disconnected pieces
```

Before future changes, verify that these points are not regressed.

## Assembly auto vertical collision resolve

When dragging a piece in top/bottom view, collision on X/Y is resolved by testing vertical positions in 0.5 catalog-unit steps. Top view searches upward; bottom view searches downward. Front/side views remain strict. If the final position has no compatible anchor path to the root assembly graph, only that piece receives the red invalid contour.

## Current drag resolution priority

Assembly drag now resolves movement in this order:

```txt
1. Snap to 0.5 catalog-unit grid on X/Y/Z.
2. Try lateral side-anchor snap at the current height.
3. If a valid side-anchor pair exists, keep Z and align anchors exactly.
4. Only if side-anchor snap fails, auto-resolve vertically in top/bottom view.
5. Mark only non-connected pieces with a red contour.
```

This prevents a side-by-side piece from climbing above another piece before its side anchors had a chance to attach.
## Assembly drag stability

- Drag targets are recalculated from the drag start position plus pointer delta.
- Side-anchor snap is same-height and has priority over auto-Z.
- Side snap candidates are bounded and cannot teleport pieces outside the scene.
- Auto-Z is used only after side-anchor snap fails.
- Invalid positions are rejected instead of being written to the instance transform.


## 2026-06-09 correction — side snap release before auto-Z

Assembly drag now treats side-anchor snap as a short-range hold, not a permanent lock.

Rule:

```txt
same-height side snap is tried first
but only within 0.49 snap step of the exact contact position
if the user drags one half-step into another piece, side snap releases
auto-Z can then lift/drop the piece by 0.5 steps
```

This preserves the desired order:

```txt
anchor side contact first
then pass above/below when the user pushes further
```
