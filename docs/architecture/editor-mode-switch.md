# Editor Mode Switch

## Phase 4 scope

- `state.editorMode` lives only in Editor state.
- default mode is `simple`.
- mode `advanced` is read-only preview:
  - active variant kept
  - bounding box summary kept
  - 0.5 grid reported as preview
  - no point/face editing interaction

## Current behavior

- `simple`
  - existing Editor workflow remains active
- `advanced`
  - workbench editing controls are disabled
  - preview stays loaded for the same selected variant
  - catalog data is not modified by the mode switch itself

## Non-goal

- no advanced geometry creation workflow is introduced in this phase.
