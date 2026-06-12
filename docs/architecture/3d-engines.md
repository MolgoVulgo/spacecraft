# 3D engines

The project now separates 3D responsibilities into three layers:

## Shared core

Files under `src/3d/core/` are pure shared helpers.

- scene-independent geometry generation
- materials
- bounds
- anchors
- catalog lookup

Rules:

- `src/3d/core` must not import from Assembly
- `src/3d/core` must not import from Editor

## Assembly engine

Files under `src/3d/assembly/` handle placed-part interactions only.

- piece selection
- grouping
- movement
- snap
- collision checks

Assembly consumes published catalog shapes only.

## Editor engine

Files under `src/3d/editor/` handle part authoring only.

- simple mode
- advanced point/edge/face workflow
- planar operations (`custom_face`, `cut`)
- compilation to catalog output

Editor may keep transient draft state in memory, but published output must remain compatible with Assembly.
