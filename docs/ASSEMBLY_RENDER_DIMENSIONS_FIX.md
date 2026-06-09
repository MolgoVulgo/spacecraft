# Assembly render dimensions fix

## Scope

Assembly must display playable parts as solid catalogue pieces, not editor voxels.

## Rules

- Catalogue dimensions are fixed for every variant.
- Assembly coordinates are normalized:
  - X = width
  - Y = depth / length
  - Z = height
- Base parts such as 4x3x1, 6x3x1 and 8x3x1 are rebuilt from catalogue dimensions, not from legacy meshes.
- Editor-only 1x1x1 voxel borders are not drawn in assembly.
- Lighting is removed from assembly visual output; part colour is homogeneous.
- External edges are drawn in black.
- Internal edges inside a flat face are not drawn.

## Implementation

- Assembly material uses `MeshBasicMaterial`.
- Scene directional/hemisphere lights are not used for assembly shading.
- Simple box edges are generated from the fixed catalogue bounds.
- Non-box shapes use `EdgesGeometry` only for hard outline edges.
