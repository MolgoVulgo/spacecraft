# Conversation Summary

## Initial situation

The project started with a Python/Qt/Ursina editor and a JavaScript/Three.js viewer/assembly. After the Qt refactor, right-click drag and piece dragging regressed. Analysis showed the problem came from mixed input layers: Qt event filters, Panda/Ursina window embedding, and Ursina input all competing.

The architectural decision changed from improving Qt/Ursina to moving the editor to a C1 web architecture.

## Main architecture decision

Final chosen architecture:

```text
C1 = local web application
Assembly = public app for building ships
Editor = internal app for creating/editing catalog pieces
3D = Three.js
Catalog = rich JSON
Python = legacy/reference only
```

Rationale:

- The assembly viewer was already JS-oriented.
- The editor and assembly must share geometry and catalog semantics.
- Python/Ursina created a second rendering/input stack and duplicated behavior.

## Rich catalog integration

The flat catalog format was replaced by a richer schema with separated concepts:

```text
sizes
families
shape_variants
spec_profiles
recipes
catalog_pieces
ship_blueprint_schema
```

A playable piece is no longer a simple object. It is a catalog entry linking:

```text
family + size + shape_variant + spec_profile + recipe
```

## Editor evolution

The editor was separated from assembly. It is for internal catalog creation/modification only.

Implemented/defined editor concepts:

- Family/material → size → shape variants tree.
- Creation of variants from fixed base models.
- Shape editing with visible voxel grid `1x1x1`.
- Anchor add/delete by selecting a voxel face.
- Anchor red dot placed at the center of the selected face.
- Specs and recipes attached to the base model via modal actions.
- Variant operations by face selection.
- Round/chamfer rules validated by user.
- Parametric point variants started.

## Geometry rules validated

Validated rules:

```text
round    = true quarter-circle 90°, radius 1
chamfer  = true diagonal 45° cut, offset 0.5
```

The wrong model was rejected:

```text
Do not add cylinders/blocks on top of voxels.
Modify/rebuild the section of the volume.
```

Decorative details from game screenshots must be ignored. Only functional external geometry is modeled.

## Point/pente variants discussed

Variants introduced conceptually:

```text
point_1 / pente_1
point_2 / pente_2
point_3 / pente_3
```

Important correction:

- Pieces keep fixed catalog dimensions even if visible geometry leaves empty space.
- `4x3x1` remains `4x3x1` for placement, anchors, collision envelope, and catalog identity.
- `point_1` and `point_2` tips go toward a side, never toward the center.
- `point_3` was considered closer/correct.

## Assembly evolution

Assembly must be public/user-facing and must not expose catalog editing.

Key intended behavior:

- Select family/material.
- Size list drives adding pieces.
- Double-click a size to add a piece.
- Drag-drop a size onto scene to add a piece.
- Shape palette modifies the selected scene piece; it must not add a new piece.
- Profiles are not needed as a visible select if they do not provide user value.
- Pieces in assembly are rendered as unified solids, not voxel-separated blocks.
- Editor is the only mode that shows `1x1x1` voxel separation.

## Source of truth

The project briefly used localStorage to publish editor catalog copies to assembly. This was rejected.

Final rule:

```text
No localStorage catalog copy.
Single source: public/data/4x3x1_catalog.json
```

In dev, Editor may publish by writing through a Vite endpoint:

```text
PUT /api/catalog/write
```

Assembly reads only:

```text
/data/4x3x1_catalog.json
```

## Current blocking area

The drag/snap/anchor/auto-Z logic became unstable after several patches.

Observed regressions:

- Piece sent far away on Y axis during side-anchor snap.
- Piece no longer passes above another.
- Piece became stuck to another piece.
- Even a single piece stopped moving after drag-controller changes.

Conclusion:

```text
Do not continue patching this intertwined logic.
Restart from stable drag/drop code and implement a dedicated drag controller.
```
