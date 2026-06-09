# Stable Restart Notes

The user intends to restart from a stable code version where drag/drop works. This is the correct approach.

Do not blindly merge the latest generated `src/main.js` from the unstable versions. Use the documentation here to reapply intended behavior cleanly.

## What to cherry-pick from later work

Safe concepts to cherry-pick:

```text
- CURRENT_ARCHITECTURE.md content
- AGENTS.md rules
- no localStorage catalog source
- shape-engine as unique generator
- anchor toggle in assembly
- selected outline blue theme variable
- invalid outline red only for disconnected pieces
- editor voxel / assembly solid split
```

Risky code to avoid cherry-picking directly:

```text
- late drag transit patches
- side-anchor push-through patches
- large applyDragPosition/tryMoveInstance changes
- any code that made single-piece movement fail
```

## Recommended stable baseline selection

Pick the version where these are true:

```text
- pieces can be added by double-click/drag-drop
- pieces can be dragged normally
- pieces do not jump/disappear
- assembly scene scale/grid are correct
- shape-engine is already unified or easy to reapply
```

If using an older baseline before shape-engine unification, reapply that separately before the movement refactor.

## Codex prompt framing

Use a narrow prompt:

```text
Refactor assembly movement only. Do not touch catalog schema, editor UI, shape geometry, recipes, specs, or unrelated rendering.
```

This prevents Codex from rewriting stable unrelated areas.
