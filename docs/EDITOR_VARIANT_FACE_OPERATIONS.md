# Editor variant face operations

The catalog editor no longer exposes manual operation targets for variant correction.

Variant corrections now follow the same interaction model as anchors:

1. Select a voxel face in the 3D editor.
2. Click `Arrondir face` or `Chanfreiner face`.
3. The editor creates a shape operation bound to that selected face.

Fixed operation values:

- `round.radius = 1.0`
- `chamfer.size = 0.5`

The stored operation keeps the original face selection:

```json
{
  "type": "round",
  "radius": 1.0,
  "target": "corner",
  "selection": {
    "cell": { "x": 3, "y": 2, "z": 0 },
    "face": "top",
    "position": { "x": 3.5, "y": 2.5, "z": 1 }
  },
  "scope": {
    "kind": "corner",
    "label_fr": "angle right/back",
    "affected_faces": ["right", "back"]
  },
  "status": "draft"
}
```

Derived scope rules:

- top/bottom face on a corner cell -> corner operation affecting the two adjacent sides.
- top/bottom face on an edge cell -> line operation along that edge.
- side face on the top row -> top side line operation.
- other side face -> side line operation.

The editor remains voxel-first: visual selection is done on 1x1x1 cells, while round/chamfer corrections are stored as parametric operations in `generation.operations[]`.
