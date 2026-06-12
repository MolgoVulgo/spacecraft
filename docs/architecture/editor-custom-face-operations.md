# Editor advanced mode: custom_face and cut operations

Phase 9 now exposes two planar advanced operations:

- `custom_face`
- `cut`

Goal:

- keep point/edge/face drafting local to the Editor advanced mode;
- validate explicitly before touching `generation.operations[]`;
- let Assembly consume the same operation after publication.

Current workflow:

1. Build a draft face from points/edges in advanced mode.
2. Select that draft face in the advanced panel.
3. Choose the operation type:
   - `custom_face`
   - `cut`
4. For `cut`, choose the kept side:
   - `Normale`
   - `Inverse`
5. Click `Créer opération depuis face`.
6. The editor converts the draft face into:

```json
{
  "id": "custom_face_...",
  "type": "custom_face",
  "target": "custom_face",
  "scope": {
    "kind": "custom_face",
    "label_fr": "face personnalisée"
  },
  "point_ids": ["..."],
  "points": [
    { "x": 0, "y": 0, "z": 1 },
    { "x": 2, "y": 0, "z": 1 },
    { "x": 1, "y": 1, "z": 1 }
  ],
  "normal": { "x": 0, "y": 0, "z": 1 },
  "status": "draft",
  "metadata": {
    "source": "editor_advanced_face"
  }
}
```

For `cut`, the stored operation is:

```json
{
  "id": "cut_...",
  "type": "cut",
  "target": "cut",
  "scope": {
    "kind": "cut",
    "label_fr": "coupe plane"
  },
  "point_ids": ["..."],
  "points": [
    { "x": 0, "y": 0, "z": 0.5 },
    { "x": 4, "y": 0, "z": 0.5 },
    { "x": 0, "y": 3, "z": 0.5 }
  ],
  "normal": { "x": 0, "y": 0, "z": 1 },
  "keep_side": "normal",
  "status": "draft"
}
```

Rendering rule:

- the shared mesh generator triangulates the stored polygon and injects it into the generated geometry;
- for `cut`, the shared mesh generator clips the solid with the stored plane and rebuilds a cap on the cut;
- the base piece stays unchanged until validation;
- deleting the operation removes that planar operation locally and from published catalog output.

Scope limits for this phase:

- no collision rewrite;
- no legacy `advanced_mesh` export path.
