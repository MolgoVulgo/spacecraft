# C1 Rich Catalog Migration

## Result

The web app now consumes the rich catalog model instead of the previous flat `catalog/pieces` file.

## Data migration

Old pieces were migrated into:

```text
shape_variants[]     -> geometry, anchors, collision metadata
spec_profiles[]      -> technical profile placeholders
recipes[]            -> crafting placeholders
catalog_pieces[]     -> selectable playable entries
```

Unknown values are represented explicitly:

```json
{ "value": null, "status": "unknown" }
```

## Transitional geometry

The previous Python/STL meshes are kept under:

```text
shape_variants[].preview_mesh
shape_variants[].generation.mode = legacy_mesh
```

This keeps the app usable while leaving room for controlled parametric shape operations later.

## App changes

The app now uses repository-style lookups:

```text
sizes
families
shapeVariants
specProfiles
recipes
catalogPieces
```

Assembly instances reference `catalog_piece_id` and do not duplicate catalog data.

## Validation

The right panel reports reference errors and migration warnings.

Expected warnings at this stage:

```text
legacy_mesh: mesh migré temporaire
```

These warnings are normal until the parametric generator replaces the migrated preview meshes.


## Creation workflow added

The editor now supports direct catalog enrichment:

```text
Create shape_variant
  -> choose size
  -> choose primitive base: box / wedge length / wedge width
  -> auto-generate canonical anchors
  -> save as draft shape variant

Create catalog_piece
  -> choose family
  -> choose size
  -> choose shape_variant
  -> choose profile type
  -> auto-create missing spec_profile placeholder
  -> auto-create missing recipe placeholder
  -> link everything through catalog_piece
```

Shape variants remain catalog geometry. Catalog pieces remain selectable game entries. Placed pieces still reference `catalog_piece_id` only.

Implemented primitive generation:

```text
primitive_stack/base.type = box
primitive_stack/base.type = wedge, slope_axis = length
primitive_stack/base.type = wedge, slope_axis = width
```

Not implemented yet:

```text
chamfer
round
quarter_round
half_round
layered composition
precise generated collision
```
