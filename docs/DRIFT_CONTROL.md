# DRIFT_CONTROL.md

## Entry points

```text
index.html  -> Assembly only
editor.html -> Editor only
```

Do not reintroduce mixed runtime responsibilities.

## Module ownership

```text
src/main.js                           -> Assembly integration/controller
src/editor.js                         -> Editor integration/controller
src/shape-engine.js                   -> canonical final geometry source
src/assembly-drag-controller.js       -> pointer/keyboard interaction state
src/assembly-movement.js              -> validated batch/group movement
src/history/command-stack.js          -> undo/redo stack
src/history/commands/move-command.js  -> movement command snapshots
src/catalog-validator.js              -> catalog contract validation
src/scene-validator.js                -> ship scene/group contract validation
src/ship-creation.js                  -> ShipCreation model/import/export helpers
src/assembly-persistence-controller.js -> autosave/open/import/export orchestration
```

## Forbidden patterns

```text
- final piece geometry in src/main.js
- duplicate final geometry builders in src/editor.js
- localStorage as catalog source
- Assembly runtime exposing Editor forms/actions
- partial group transform application
- hidden scene mutations outside validated movement/history paths
- schema edits to public/data/4x3x1_catalog.json without explicit request
```

## Movement rules

```text
- snap grid = 0.5
- side-anchor snap before auto-Z
- top view auto-Z = Z+
- bottom view auto-Z = Z-
- drag validation must stay strict on release
- batch/group movement must apply atomically
```

## History rules

```text
- command stack default limit = 10
- movement only for now
- no history entry for failed/cancelled move
- redo cleared only after a new committed command
```

## Validation commands

Run before commit:

```bash
npm run test
npm run build
npm run build:assembly
node scripts/validate-catalog.mjs public/data/4x3x1_catalog.json
```

Optional legacy reference only:

```bash
npm run test:python:legacy
```

## Manual checks

Assembly:

```text
[ ] add piece
[ ] drag piece
[ ] keyboard move piece
[ ] create/select/move group
[ ] mixed selection move
[ ] undo
[ ] redo
[ ] save/reload creation
```

Editor:

```text
[ ] load editor.html
[ ] preview standard block
[ ] preview rounded/chamfer/slope/point variants
[ ] edit anchors/specs/recipes if touched
[ ] export/publish catalog if touched
```
