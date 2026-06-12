# Current 3D Flow

## Entry points

- `src/main.js`: bootstrap Assembly, scene/camera/renderer setup, catalog loading, piece/group selection, drag/snap, collisions, persistence, Assembly UI wiring.
- `src/editor.js`: bootstrap Editor, scene/camera/renderer setup, catalog editing UI, voxel face selection, anchor editing, variant/spec/recipe workflows, advanced mesh editing.

## Current responsibility map

### 3D rendering and scene bootstrap

- `src/main.js`
  - Creates Assembly renderer, scene, camera, controls, grid, selection box.
  - Mounts Assembly navigation cube and viewport behaviors.
- `src/editor.js`
  - Creates Editor renderer, scene, camera, controls, preview groups.
  - Mounts Editor navigation cube and preview behaviors.
- `src/view-controller.js`
  - Shared camera/view helpers for canonical top/front/left/right/home views.
- `src/navigation-cube.js`
  - Shared navigation cube metadata and view API.
- `src/navigation-cube-overlay.js`
  - Shared navigation cube DOM overlay renderer.

### Mesh generation and geometry

- `src/shape-engine.js`
  - Shared geometry generation from `shape_variants`.
  - Shared voxel/operation-based solid generation.
  - Shared world/catalog coordinate conversion helpers.
  - Shared reservation box generation.
- `src/advanced-mesh.js`
  - Editor-oriented advanced mesh definition helpers and validation.

### Assembly interactions

- `src/assembly-drag-controller.js`
  - Pointer/keyboard interaction state machine for Assembly.
  - Marquee selection, camera drag routing, keyboard move routing.
- `src/assembly-movement.js`
  - Isolated subset of Assembly movement validation and batch/group move application.
- `src/main.js`
  - Still owns most Assembly movement logic:
    - piece/group picking
    - drag plane projection
    - half-grid snap
    - side-anchor snap
    - auto-Z resolution
    - collision checks
    - attachment updates
    - selection state and history integration

### Anchors

- `src/shape-engine.js`
  - Shared anchor/world position helpers via catalog coordinate conversion.
- `src/main.js`
  - Assembly anchor creation, visibility, compatibility checks, attachment graph updates.
- `src/editor.js`
  - Editor anchor authoring, selection, add/remove/toggle logic.

### Variants

- `src/main.js`
  - Assembly variant palette, variant filtering, selected-piece variant switching.
- `src/editor.js`
  - Variant creation, duplication, deletion, icon assignment, shape mode switching.

### UI ownership

- Assembly UI: `index.html` + `src/main.js` + `src/assembly-persistence-controller.js` + `src/ship-creation.js` + history modules.
- Editor UI: `editor.html` + `src/editor.js`.

## Shared functions/modules used by both Assembly and Editor

- `src/shape-engine.js`
  - `buildShapeGeometry`
  - `createCatalogReservationBox`
  - `catalogPointVector`
  - `catalogCellCenterVector`
- `src/view-controller.js`
  - canonical camera/view helpers
- `src/navigation-cube.js`
  - navigation cube items and view API
- `src/navigation-cube-overlay.js`
  - cube overlay DOM mount
- `src/runtime-paths.js`
  - runtime asset/data path resolution

## Strictly Assembly-specific modules/functions

- `src/assembly-drag-controller.js`
- `src/assembly-movement.js`
- `src/assembly-persistence-controller.js`
- `src/ship-creation.js`
- `src/history/command-stack.js`
- `src/history/commands/move-command.js`
- `src/main.js` functions around:
  - instance/group selection
  - assembly group lifecycle
  - drag/snap/collision/auto-Z
  - palette application on placed pieces
  - persistence and ship stats

## Strictly Editor-specific modules/functions

- `src/advanced-mesh.js`
- `src/editor.js` functions around:
  - base reference management
  - voxel face picking
  - anchor authoring
  - face operations
  - advanced mesh vertex/face editing
  - spec/recipe modals
  - catalog export/publish

## Refactor seam for next phases

- Shared 3D helpers are already partially extracted in:
  - `src/shape-engine.js`
  - `src/view-controller.js`
  - `src/navigation-cube.js`
  - `src/navigation-cube-overlay.js`
- Assembly movement is only partially extracted:
  - `src/assembly-drag-controller.js` handles interaction orchestration.
  - `src/assembly-movement.js` handles a narrow movement subset.
  - `src/main.js` remains the main bottleneck for drag/snap/collision behavior and is the primary phase 2 extraction target.
