# Assembly voxel render mode

Assembly now uses the same voxel display path as the editor for placed pieces.

Reason: the solid assembly renderer still had dimension/orientation divergence. This mode deliberately removes the solid reconstruction layer from Assembly while keeping the single shape-engine path.

Rules:

- `src/main.js` calls `buildShapeGeometry(..., showVoxels: true)`.
- `src/editor.js` already calls `buildShapeGeometry(..., showVoxels: true)`.
- `src/shape-engine.js` remains the only shape generator.
- Assembly selection/collision still uses the fixed catalog reservation box, not visible voxel gaps.
- Assembly edges use `THREE.EdgesGeometry(geometry, 18)` so voxel cells are visible like in the editor.

This is an explicit debug/stabilization mode, not the final solid visual target.
