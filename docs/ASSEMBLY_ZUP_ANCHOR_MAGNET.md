# Assembly Z-up, anchors and magnetic snap

## Scope

Assembly remains catalogue-only. The editor keeps voxel editing; assembly renders pieces as unified solid volumes.

## Scene convention

Assembly uses one scene convention:

```txt
X = catalog width
Y = catalog length / depth
Z = catalog height
```

The grid is generated as custom line geometry in the XY plane with Z-up semantics. It no longer relies on the default Three.js Y-up GridHelper plane.

## Anchors

Anchors are hidden by default in assembly. A button toggles their visibility:

```txt
Afficher ancres / Masquer ancres
```

Editor still shows anchors as red points for placement and correction workflows.

## Magnetic placement

Piece movement is constrained to half-unit steps:

```txt
step = mesh_unit_scale * 0.5
```

This matches the intended anchor density: a 4-unit side has 8 possible half-unit positions.

When dragging a piece near another piece, assembly tries to snap exterior faces together before collision validation:

```txt
moving min X -> other max X
moving max X -> other min X
moving min Y -> other max Y
moving max Y -> other min Y
```

The candidate is then checked against fixed catalogue reservation boxes. Overlap is rejected.
