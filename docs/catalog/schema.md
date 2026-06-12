# Catalog schema notes

Published catalog output must remain compatible with Assembly.

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

Compilation rules:

- preserve `variant_index`
- preserve linked `catalog_pieces`
- preserve `spec_profiles`
- preserve `recipes`
- refuse export if advanced draft edges/faces are still incomplete
- regenerate `preview_mesh` from the compiled geometry
