# Assembly height snap and anchor validation

## Scope

Assembly placement now uses the same half-unit snap on all axes:

```text
X = width
Y = depth / length
Z = height
snap step = 0.5 catalog unit
```

With the default `mesh_unit_scale = 100`, the snap step is `50` scene units.

## Height movement

The `Monter`, `Descendre`, `PageUp`, `PageDown`, and manual height input paths snap Z to the half-unit grid.

This prevents a piece from being vertically offset outside the same attachment grid used for X/Y placement.

## Anchor validation

A placed piece is valid when:

- it is the first piece in the scene, or
- it touches another piece on one face, and
- at least one compatible anchor pair coincides at the contact face.

Compatible anchors require:

- same world position within tolerance,
- opposite normals,
- no collision overlap.

If no compatible anchor exists, the piece is not deleted. Its contour turns red to expose the placement error.

## Placeholder anchor grids

Some migrated catalog entries still contain only six placeholder anchors, one at the center of each face. Assembly expands those placeholder sets into a generated half-step face grid for placement validation and anchor display.

Example:

```text
4x3x1 long side -> length 4 -> 8 half-step anchor positions
```

If a shape has no anchors at all, no virtual anchors are generated and unattached placements are marked invalid.
