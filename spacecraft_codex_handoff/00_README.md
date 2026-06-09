# SpaceCraft C1 — Codex Handoff Pack

This pack is a documentation checkpoint for restarting development from a stable code version.

The current conversation reached a point where repeated patches around assembly drag/snap/anchor/auto-Z interactions started producing regressions. The recommended path is not to continue patching the latest unstable drag code, but to restart from the last stable version where basic drag/drop works, then reimplement the assembly drag controller cleanly.

Core status:

- Web C1 architecture is the selected target.
- Assembly and Editor are separate apps.
- The catalog is a rich JSON model.
- `src/shape-engine.js` must remain the unique geometry engine.
- `src/main.js` must not contain shape generators.
- The remaining hard problem is the assembly drag controller.

Recommended immediate Codex objective:

```text
Refactor assembly movement into a dedicated controller with tests:
src/assembly-drag-controller.js
```

Do not reintroduce localStorage catalog copies. Do not merge Editor and Assembly again.
