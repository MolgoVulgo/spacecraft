# AGENTS.md — SpaceCraft C1 Codex Instructions

## Role

You are working on a local web application for a SpaceCraft offline ship planner.

The user expects concise implementation, not broad explanations. Return short technical summaries after code changes.

## Hard rules

- Do not reintroduce Python/Qt/Ursina as active runtime.
- Do not merge Assembly and Editor.
- Do not use localStorage as catalog source.
- Do not add arbitrary free-size parts.
- Do not generate shape geometry in `src/main.js`.
- Do not rewrite unrelated UI when working on movement.
- Do not change catalog schema unless explicitly requested.
- Do not model decorative details from screenshots.

## Architecture rules

```text
index.html   = Assembly public app
editor.html  = Editor internal app
src/main.js  = Assembly controller
src/editor.js = Editor controller
src/shape-engine.js = unique geometry engine
public/data/4x3x1_catalog.json = catalog source
```

Coordinate convention:

```text
X = width
Y = depth / length
Z = height
```

Assembly:

```text
showVoxels = false
solid/unified render
anchors hidden by default
size list adds pieces
shape palette modifies selected piece
```

Editor:

```text
showVoxels = true
voxel 1x1x1 edit view
anchors editable by selected face
specs/recipes via modals
```

## Current priority

Refactor assembly movement.

Recommended file:

```text
src/assembly-drag-controller.js
```

Do not continue adding nested patches to `src/main.js` movement functions.

## Movement acceptance criteria

Baseline first:

```text
- single piece moves freely in all views
- snap grid = 0.5
- no anchor logic blocks a single piece
- multi-piece free move works when no collision
```

Then:

```text
- side-anchor snap before auto-Z
- moving away detaches immediately
- pushing through side contact releases side snap
- auto-Z begins only after side snap release/failure
- top view auto-Z = Z+
- bottom view auto-Z = Z-
- final mouseup validation is strict
```

## Reporting style

After changes, report:

```text
Changed files
What was changed
Tests run
Known limitations
```

Keep it short.

## Git rule

- When the user asks for a commit, always include all modified files in the workspace commit.
