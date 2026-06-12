# Shared 3D Core

## Phase 1 scope

- `src/3d/core/meshGeneration.js`
  - shared geometry generation moved under the dedicated core folder
  - Assembly and Editor now import mesh generation from here
- `src/3d/core/bounds.js`
  - shared reservation box and geometry bounds helpers
- `src/3d/core/anchors.js`
  - shared anchor coordinate conversion and placeholder-anchor expansion
- `src/3d/core/catalogLookup.js`
  - shared catalog map/lookup helpers
- `src/3d/core/materials.js`
  - shared simple color material factory

## Compatibility layer

- `src/shape-engine.js` remains as a thin re-export wrapper to avoid breaking existing imports/tests during the transition.

## Intentional non-goals for this phase

- No Assembly drag/snap logic moved yet.
- No Editor interaction logic moved yet.
- No visible behavior change expected.
