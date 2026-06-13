# Catalog schema notes

Published catalog output must remain compatible with Assembly.

Functional model:

```txt
shape           -> géométrie, cellules, ancres, symétries de forme
catalog_piece   -> pièce jouable concrète
family          -> famille fonctionnelle
part_type       -> type métier dans une famille
material        -> matériau / technologie
placement_rules -> orientations, montages, zones fonctionnelles
```

Backward compatibility rules:

- `catalog_pieces[].type_id` is optional during migration.
- `catalog_pieces[].material_id` is optional during migration.
- `catalog_pieces[].placement_rules` is optional during migration.
- Missing `type_id` means legacy structural part.
- Missing `placement_rules` keeps current structural behavior.

Relevant shape fields:

```json
{
  "id": "shape_variant_id",
  "size_id": "4x3x1",
  "variant_index": 3,
  "generation": {
    "mode": "voxel_grid",
    "base": {},
    "cells": [],
    "operations": []
  },
  "anchors": [],
  "collision": {
    "mode": "base_box"
  },
  "preview_mesh": {
    "vertices": [],
    "faces": []
  }
}
```

Current advanced planar operations stored in `generation.operations[]`:

- `custom_face`
- `cut`

Optional functional extensions on `catalog_pieces[]`:

```json
{
  "family_id": "propulsion",
  "type_id": "engine",
  "material_id": "steel",
  "placement_rules": {
    "allowed_orientations": [],
    "allowed_symmetry": {
      "length": false,
      "width": true,
      "height": false
    },
    "mount_points": [],
    "functional_zones": []
  }
}
```

Compilation rules:

- preserve `variant_index`
- preserve linked `catalog_pieces`
- preserve `spec_profiles`
- preserve `recipes`
- refuse export if advanced draft edges/faces are still incomplete
- regenerate `preview_mesh` from the compiled geometry
