# Python Piece Editor V6

## Run

```bash
python -m pip install -r requirements.txt
python ./main.py
```

## Native shell

The editor now runs through a native Qt shell with the 3D viewport centered between the side panels:

```bash
python ./main.py
```

Current scope:

- native menu bar
- native left control panel
- native right inspector panel
- embedded Ursina/Panda3D viewport

Alternative entry point:

```bash
python -m piece_editor.app_shell
```

## V6 fixes

- removes the large white UI panel;
- uses solid dark buttons;
- forces readable button text;
- uses orange pieces instead of white;
- reduces grid brightness;
- keeps the V4 logic: edit mode, assembly mode, logical size, anchor cells, collisions, mirrors, height movement.

## Current edit model

- a piece now belongs to a material family: `acier` or `titane`;
- each material exposes only allowed base sizes;
- the base size stays fixed as the logical envelope;
- each base family can expose explicit shape variants such as `standard`, `slope`, `chamfer`, `round_side`;
- the editor stores `family`, `variant`, and `shape` metadata alongside the logical envelope;
- each piece carries stable catalog specs keys such as `system`, `mass`, `heatCapacity`, and `decoration`;
- custom meshes are now stored in Python source data and exported back to the web catalog;
- the edited shape is defined by `solid_cells` on a `1x1x1` grid;
- anchor points remain separate from solid cells;
- when a catalog shape is edited, the editor falls back to the logical voxel view.

## Current edit controls

- `1` / `2`: previous / next material;
- `3` / `4`: previous / next base size;
- `Variant`: choose the shape family subtype;
- `Variant shape` / `Voxel shape`: switch between parametric variant rendering and manual `1x1x1` volume editing;
- `Shape` fields: edit the current subtype parameters (`axis`, `profile`, `radius`, etc.);
- `Reset variant`: restore the current subtype default shape;
- `Fill volume` / `Clear volume`: quickly initialize manual voxel editing;
- `Space`: toggle solid cell at cursor;
- `R`: toggle anchor cell at cursor.

## Save behavior

- `Save piece` updates `tools/data/pieces.json`;
- it also writes the current piece snapshot to `tools/data/user_piece.json`.
- it exports the JS catalog to `public/data/4x3x1_catalog.json`.

## Specs

- the editor keeps stable spec keys in piece JSON even when no numeric rule is defined yet;
- missing spec values default to empty values with preserved labels and units;
- the status panel shows the current piece specs in edit and assembly modes.

## Validation

```bash
python -m compileall .
python -m pytest
```
