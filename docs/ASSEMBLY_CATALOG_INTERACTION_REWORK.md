# Assembly catalog interaction rework

## Scope

Assembly no longer exposes an “Add to assembly” button.

Pieces are added from the catalog by:

- double-clicking a catalog piece name;
- dragging a catalog piece name into the scene.

## Catalog display

The public assembly list displays the resolved shape variant label instead of only internal variant ids.

Grouping:

```txt
Family / material · size
└── shape variant label
```

## Geometry engine

Assembly now uses the shared `src/shape-engine.js` module for shape generation.

The editor also uses the same module for parametric point shapes.

This avoids the previous drift where the editor could preview a shape while assembly rebuilt it with older local logic.

## Fixed dimensions

All variants keep the fixed catalog dimensions as their reservation box.

The visible mesh may leave empty/transparent zones, but collision/reservation remains based on the fixed catalog size.

## Point shape correction

`point_1` and `point_2` now point toward a side via `generation.base.tip_side`, defaulting to `left`.

They no longer converge toward the center.

`point_3` remains unchanged.
