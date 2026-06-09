# What Works / What Should Be Preserved

## Architecture

- C1 web architecture is the correct target.
- Assembly and Editor separation is correct.
- Assembly must be public/user mode.
- Editor must be internal/catalog mode.
- Rich catalog model is correct.
- Single catalog source via `public/data/4x3x1_catalog.json` is correct.
- localStorage catalog copy must not return.

## Catalog model

The following structure is correct and should stay:

```text
sizes
families
shape_variants
spec_profiles
recipes
catalog_pieces
ship_blueprint_schema
```

A selectable catalog part must be:

```text
catalog_piece = family + size + shape_variant + spec_profile + recipe
```

## Editor

Preserve:

- Family/material → size → variants tree.
- Voxel `1x1x1` edit representation.
- Anchor creation by selecting a voxel face + button.
- Anchor deletion by selecting face + button.
- Red anchor dot centered on face.
- Specs and recipes as modals attached to base family/size, not always-visible panels.
- Creation of variants from fixed catalog sizes/families.

## Geometry rules

Preserve:

```text
round radius = 1
chamfer offset = 0.5
snap grid = 0.5
fixed catalog dimensions always remain true
```

Assembly pieces must appear as unified solids; voxel separation is editor-only.

## Rendering/camera decisions

Preserve:

```text
X = width
Y = depth / length
Z = height
```

Assembly grid must be in XY plane with Z as height.

Views:

```text
top    -> X/Y
front  -> X/Z
side   -> Y/Z
```

## Assembly UI decisions

Preserve:

- Family select should be compact.
- Size list drives piece addition.
- Double-click size = add piece.
- Drag-drop size onto scene = add piece.
- Shape palette modifies selected scene piece; it must not create a new piece.
- Profile select should stay removed unless it becomes functionally useful.
- Anchors hidden by default in assembly, with a toggle button.
- Selected hitbox should be blue and theme-configurable.
- Only invalid/unconnected pieces should be red.

## Useful docs already created in project

Keep these concepts:

```text
CURRENT_ARCHITECTURE.md
AGENTS.md
docs/CURRENT_ARCHITECTURE.md
docs/spacecraft_rich_catalog_schema.md
```
