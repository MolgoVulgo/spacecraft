# Code Architecture Explanation

## Top-level apps

```text
index.html   -> Assembly public app
editor.html  -> Editor internal catalog app
```

Assembly and Editor must be independent at UI level. They may share data model and geometry engine, but they must not share user workflows.

## Main files

```text
src/main.js          Assembly app controller
src/editor.js        Editor app controller
src/shape-engine.js  Shared geometry engine
src/style.css        Shared CSS/layout/theme base
public/data/4x3x1_catalog.json  Rich catalog source
vite.config.js       Vite build + dev catalog write endpoint
```

## Source of truth

The catalog source is:

```text
public/data/4x3x1_catalog.json
```

Do not use localStorage for catalog state. Browser memory may hold temporary editing state, but assembly must load from the file endpoint only.

## Shared geometry engine

`src/shape-engine.js` is the only valid place for shape generation.

Expected convention:

```text
X = width
Y = depth / length
Z = height
```

This convention must apply consistently to:

- generated meshes;
- reservation/collision boxes;
- anchor world positions;
- grid;
- camera views;
- drag planes.

## Assembly responsibilities

`src/main.js` should handle:

- scene setup;
- loading catalog;
- rendering assembly UI;
- adding/removing/duplicating scene pieces;
- piece selection;
- camera/view controls;
- drag/drop interaction;
- anchor visibility toggle;
- validation display;
- blueprint export.

`src/main.js` must not contain shape mesh generation logic. It may call `buildShapeGeometry()` and `createCatalogReservationBox()` from `shape-engine.js`.

## Editor responsibilities

`src/editor.js` should handle:

- rich catalog editing;
- family/size/variant tree;
- voxel editing view;
- anchor add/delete by selected voxel face;
- spec and recipe modals;
- variant creation and duplication;
- shape operation creation;
- catalog validation;
- catalog export/publish.

Editor uses `showVoxels: true` when calling the shape engine.

## Shape engine responsibilities

`src/shape-engine.js` should handle:

- base box generation;
- wedge/prism/point variants;
- round/chamfer operations;
- legacy mesh fallback if kept;
- voxel representation for editor;
- solid representation for assembly;
- symmetry transforms;
- reservation box construction;
- catalog coordinate to world coordinate conversion.

## Current known architecture smell

`src/main.js` became too large and contains too much drag/snap/collision logic. This should be extracted.

Recommended new module:

```text
src/assembly-drag-controller.js
```

Expected role:

```text
Input target position
+ current view
+ selected instance
+ catalog/anchors/collisions
= resolved movement result
```

Return an explicit result object, not hidden side effects.
