# Python Piece Editor Guide

## Role

The Python editor in `tools/` is the source tool for piece creation.

It is used to:

- define the logical size of a piece;
- choose a material and an allowed base size;
- choose a variant shape;
- edit a manual voxel volume inside the fixed logical envelope;
- edit anchor cells;
- preview the piece in 3D;
- add piece instances to an assembly scene;
- save durable piece JSON data.

The browser viewer is not the authoring tool.

## Launch

From `tools/`:

```bash
python -m pip install -r requirements.txt
python ./main.py
```

## Coordinate system

Logical piece coordinates:

- `x` = length
- `y` = width
- `z` = height

Ursina scene mapping:

- scene `X` = logical length
- scene `Z` = logical width
- scene `Y` = logical height

## Core rules

- The logical size is authoritative.
- A piece cannot be smaller than the selected allowed base size.
- The internal `1x1x1` cells are edit cells, not the real size of the piece.
- Collision uses the full logical envelope.
- Face contact, edge contact, and corner contact are allowed.
- Positive-volume overlap is blocked.

## Modes

### Edit mode

Use edit mode to work on one piece definition.

What you can do:

- choose material;
- choose base size;
- choose variant;
- switch between variant rendering and voxel editing;
- modify the shape parameters of a variant;
- fill or clear the editable volume;
- toggle solid cells;
- toggle anchor cells;
- save the current piece.

### Assembly mode

Use assembly mode to place several piece instances in one scene.

What you can do:

- add an instance from the current piece;
- select instances;
- move the selected instance;
- drag an instance with the mouse;
- delete the selected instance;
- check collisions visually.

## Menu

The left menu is divided into sections.

### Mode

- `Edit`
  Switch to edit mode.
- `Assembly`
  Switch to assembly mode.

### Catalog

- `Material`
  Select the material family: `acier` or `titane`.
- `Base size`
  Select one of the allowed logical sizes for the current material.
- `Variant`
  Select the current shape family subtype.

### Shape

- `Variant shape`
  Display and edit the parametric variant shape.
- `Voxel shape`
  Display and edit the piece as a manual `1x1x1` volume.
- `Shape ...`
  Dynamic fields shown only when the selected variant needs parameters.

Examples of dynamic parameters:

- slope axis;
- slope profile;
- start / end;
- low / high;
- round side;
- radius;
- chamfer side;
- chamfer count;
- amount.

### Edit

- `Reset variant`
  Restore the default parametric shape of the current variant.
- `Fill volume`
  Fill the editable voxel volume inside the full logical envelope.
- `Clear volume`
  Reset the voxel volume to one minimal cell.
- `Prev piece`
  Load the previous catalog piece.
- `Next piece`
  Load the next catalog piece.
- `New piece`
  Create a new custom piece from the default base template.
- `Save piece`
  Save the current piece to JSON.
- `Toggle solid`
  Toggle the solid cell under the current edit cursor.
- `Toggle anchor`
  Toggle the anchor cell under the current edit cursor.

### Assembly

- `Add instance`
  Add one assembly instance from the current piece.
- `Center scene`
  Recenter the camera.
- `Delete selected`
  Delete the selected assembly instance.

## Keyboard shortcuts

### Global

- `F1`
  Switch to edit mode.
- `F2`
  Switch to assembly mode.
- `C`
  Center the scene.
- `Ctrl+S`
  Save the current piece.
- `Scroll up`
  Zoom in.
- `Scroll down`
  Zoom out.

### Edit mode

- `A`
  Move the edit cursor by `-1` on length.
- `D`
  Move the edit cursor by `+1` on length.
- `W`
  Move the edit cursor by `+1` on width.
- `S`
  Move the edit cursor by `-1` on width.
- `Q`
  Move the edit cursor by `-1` on height.
- `E`
  Move the edit cursor by `+1` on height.
- `Space`
  Toggle the solid cell under the cursor.
- `R`
  Toggle the anchor cell under the cursor.
- `1`
  Previous material.
- `2`
  Next material.
- `3`
  Previous base size.
- `4`
  Next base size.

### Assembly mode

- `Tab`
  Select the next instance.
- `A`
  Move the selected instance by `-1` on length.
- `D`
  Move the selected instance by `+1` on length.
- `W`
  Move the selected instance by `+1` on width.
- `S`
  Move the selected instance by `-1` on width.
- `Q`
  Move the selected instance by `-1` on height.
- `E`
  Move the selected instance by `+1` on height.
- `Delete`
  Delete the selected instance.

## Mouse controls

### Edit mode

- Mouse wheel
  Zoom the camera.

### Assembly mode

- Left click on a piece
  Select the hovered instance.
- Left click + drag
  Move the selected instance on the horizontal plane.
- Mouse wheel
  Zoom the camera.

## Visual helpers

- `V`
  Toggle anchor-cell visibility.
- `B`
  Toggle logical envelope outline visibility.

## Save behavior

`Save piece` writes:

- `tools/data/pieces.json`
  Main catalog updated by piece id.
- `tools/data/user_piece.json`
  Snapshot of the current piece only.

## Current edit flow

Typical flow for a new piece:

1. Choose `Material`.
2. Choose `Base size`.
3. Choose `Variant`.
4. If needed, adjust `Shape` parameters.
5. If manual editing is needed, switch to `Voxel shape`.
6. Move the cursor with `A/D/W/S/Q/E`.
7. Use `Space` to toggle solid cells.
8. Use `R` to toggle anchor cells.
9. Save with `Save piece` or `Ctrl+S`.

## Notes

- `Variant shape` is for parametric piece editing.
- `Voxel shape` is for manual `1x1x1` volume editing.
- Editing solid cells switches the piece logic to the voxel workflow.
- Assembly instances use the current piece definition but stay independent once added.
