# Main Functions Overview

This overview reflects the current code structure from the latest generated archive. The next stable implementation may restart from an older stable version, but these names are useful as reference.

## `src/shape-engine.js`

### `buildShapeGeometry({ shape, size, scale, symmetry, showVoxels })`

Central geometry entry point. It must remain the only geometry generator used by Assembly and Editor.

Expected use:

```text
Editor   -> showVoxels: true
Assembly -> showVoxels: false
```

### `applySymmetryToGeometry(geometry, symmetry)`

Applies length/width/height symmetry transforms. Must not destructively alter catalog shape definitions.

### `getBoxMesh(size, scale)`

Generates a base full box. Must respect fixed catalog dimensions.

### `getWedgeMesh(size, scale, base)`

Generates wedge/pente geometry.

### `getParametricPrismMesh(dim, type, scale, base)`

Generates point/pente parametric prism shapes.

### `getParametricFootprint(dim, type, base)`

Defines 2D footprint for parametric shapes. Important for point_1/point_2/point_3.

### `buildVoxelOperationGeometry(...)`

Editor-oriented voxel geometry with operations. Used to show editable `1x1x1` cell structure.

### `buildAssemblySolidGeometry(...)`

Assembly-oriented unified shape render. Should hide internal voxel separations.

### `createOperationGeometry(op, dim, scale)`

Generates geometry for operations like round/chamfer.

### `createCornerRoundGeometry(op, dim, scale)`

Generates true quarter-circle corner replacement. Must not add an external cylinder.

### `createCornerChamferGeometry(op, dim, scale)`

Generates true diagonal 45° chamfer replacement. Must not add an external block.

### `createCatalogReservationBox(sizeOrDimensions, scale, position)`

Generates the fixed reservation/collision box based on catalog dimensions. This is critical: collision/reservation must keep catalog dimensions even when visible geometry contains empty/transparent zones.

### `catalogPointVector(position, dim, scale)` / `catalogCellCenterVector(cell, dim, scale)`

Convert catalog/grid positions to world coordinates.

## `src/main.js` — Assembly

### `loadAssemblyCatalog()`

Loads `/data/4x3x1_catalog.json`. It must not load localStorage catalog copies.

### `buildRepository(catalog)`

Creates maps for sizes, families, shape variants, specs, recipes, catalog pieces.

### `buildGeometry(catalogPiece, symmetry)`

Calls `buildShapeGeometry()` from `shape-engine.js`. This should remain a thin wrapper.

### `createInstance(catalogPiece, options)`

Creates a scene instance: group, mesh, edges, anchors, metadata, position.

### `addCatalogPieceById(pieceId, position)`

Adds a catalog piece to the scene. Used by double-click/drag-drop from size list.

### `selectInstance(id)`

Selects an instance and updates hitbox/UI.

### `updateSelectionBox()`

Draws selected/error contour. Current theme decisions:

```text
selected = blue
invalid/not connected = red
normal = black
```

Colors should be configurable via theme constants.

### `getReservationBoxForCatalogPiece()` / `getInstanceReservationBox()`

Compute collision/reservation volumes. Must use the same `X width / Y length / Z height` convention as shape-engine.

### `collidesWithOthers(candidateBox, ignoredInstanceId)`

Collision check for scene placement.

### `getWorldAttachmentAnchorsForInstance()`

Gets anchors transformed into world space.

### `instancesHaveCompatibleAnchors(instance, other)`

Checks whether two instances have compatible exposed anchors.

### `updateAttachmentStates()` / `getAnchorConnectedRootSet()`

Marks connected/disconnected pieces. Only pieces not connected to the main group should be red.

### `configureDragPlaneForView(instance)`

Sets the drag plane depending on active view. Correct design:

```text
top    -> XY plane, normal Z
front  -> XZ plane, normal Y
side   -> YZ plane, normal X
```

### `onPointerDown()` / `onPointerMove()` / `onPointerUp()`

Pointer drag entry points. These became fragile and should delegate to a new `assembly-drag-controller.js`.

### `applyDragPosition()` / `tryMoveInstance()` / `resolveVerticalCollisionPosition()`

Current intertwined movement pipeline. Recommended: refactor, do not keep expanding this chain.

## `src/editor.js` — Editor

### `renderBaseModels()`

Renders the family/material → size → variant tree.

### `selectBaseModel(group, sizeId)`

Selects a base model to edit/create variants.

### `createVariantFromBase()`

Creates a variant from allowed family/size base.

### `createGenerationForVariantType(type, size)`

Creates default generation descriptor for variant type.

### `renderPreview()`

Renders editor preview. Must use shape-engine with voxel editing mode.

### `addAnchor()` / `deleteAnchor()`

Anchor management by selected voxel face.

### `createOperationFromSelectedFace(type)`

Creates shape operation from selected face. Round/chamfer parameters are fixed by business rules.

### `openSpecModal()` / `openRecipeModal()`

Spec and recipe editing UI.

### `validateCatalog()`

Reference/schema validation before publish/export.

## `vite.config.js`

### `/api/catalog/write`

Dev-only endpoint to write `public/data/4x3x1_catalog.json` from editor publish. In static build, direct file writing is not available; export/download is required.
