# Editor Point Shapes

This version adds global parametric point variants to the catalog editor.

## Scope

The editor remains purely geometric. Decorative panels, grooves, screws, plates, and internal reliefs from game screenshots are ignored.

Supported global shape types:

- `point_1`
- `point_2`
- `point_3`

These are not face corrections. They are base variant shapes created from an allowed family/size model.

## Creation flow

1. Select a base model in the left tree.
2. Select `Point 1`, `Pointe 2`, or `Pointe 3` in the top action bar.
3. Click `Créer variante`.
4. The editor creates a `shape_variant` with `generation.mode = "parametric_shape"`.

## Geometry model

Each point shape uses a simplified external prism profile:

- `point_1`: long centered nose with a larger rear shoulder.
- `point_2`: centered tapered nose from full rear width.
- `point_3`: asymmetric triangular point; use symmetry toggles for alternate orientations.

The editor displays a translucent 1x1x1 voxel guide for selection, but the visible solid is generated from the parametric external silhouette.

## Existing seed variants

The catalog includes draft parametric variants for:

- `4x3x1`: point 1, point 2, point 3
- `8x3x1`: point 1, point 2, point 3

They are stored as shape variants only. Catalog entries can be created from the editor when needed.

## Assembly compatibility

The public assembly app can render `generation.mode = "parametric_shape"` for the three point types.
