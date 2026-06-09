# Assembly / Editor separation

## Decision

The application is now split into two independent front-end entries.

```text
index.html   -> public assembly planner
editor.html  -> internal catalog editor
```

The editor no longer embeds the assembly planner. It only edits catalog data:

- base catalog models
- shape variants
- 1x1x1 voxel cells
- anchors
- shape operations metadata: chamfer, round, cut, wedge
- spec profiles
- recipes
- catalog entries

The assembly page remains the public user-facing planner and does not expose catalog mutation controls.

## Public assembly scope

Allowed:

```text
select catalog piece
place piece
move piece
change instance symmetry
change instance height
compute ship stats
export blueprint
```

Forbidden in public assembly:

```text
create catalog piece
create/edit shape variant
edit anchors
edit specs
edit recipes
export catalog
```

## Internal editor scope

Allowed:

```text
select base model by family/size
create shape variant from base model
duplicate shape variant
delete unused shape variant
create/delete catalog entry
edit shape cells as 1x1x1 blocks
add/remove anchors
reset default anchors
add/remove shape correction operations
edit spec profiles
edit recipes
export rich catalog JSON
```

## Base model catalog

Creation starts from fixed game base models, not arbitrary dimensions.

```text
ACIER
- Acier 4x3x1
- Acier 6x3x1
- Acier 8x3x1
- Acier 4x3x2
- Acier 6x3x2
- Acier 8x3x2
- Acier 8x6x2

TITANE SUPÉRIEUR
- Titane 4x3x1
- Titane 6x3x1
- Titane 8x3x1
- Titane 4x3x2
- Titane 6x3x2
- Titane 8x3x2
- Titane 8x6x2
- Titane 12x6x2
- Titane 16x6x2

CHÂSSIS AVANCÉS
- Châssis solide 4x3x1
- Châssis solide 6x3x1
- Châssis solide 8x3x1
- Châssis solide 8x6x2
- Châssis solide 12x6x2
- Châssis solide 16x6x2

ALLIAGES ULTRA LÉGERS
- Lévinium 4x3x2
- Lévinium 6x3x2
- Lévinium 8x3x2
```

These models are stored in `base_piece_models` inside the rich catalog.

## Geometry editor

The editor shows the current shape as a composition of `1x1x1` cells.

Shape correction operations are stored as structured metadata in:

```json
shape_variant.generation.operations[]
```

Current supported operation records:

```text
chamfer
round
quarter_round
half_round
cut
wedge
```

The 1x1x1 cell view is the editing baseline. Chamfers and rounds are preserved as operation metadata so they can later be rendered with higher visual fidelity without changing the schema.

## Build commands

Full internal build:

```bash
npm run build
```

Public user build:

```bash
npm run build:assembly
```

`build:assembly` removes `editor.html` and editor assets from `dist`.
