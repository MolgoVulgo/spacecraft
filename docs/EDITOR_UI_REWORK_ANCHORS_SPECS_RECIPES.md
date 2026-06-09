# Editor UI Rework — Anchors, Specs, Recipes

## Goal

The catalog editor must stay independent from the assembly planner.

Assembly is for end users and ship construction.
Editor is for internal catalog work: base models, shape variants, anchors, specs, and recipes.

## Changes

### Left navigation

The left panel is now a collapsible catalog tree:

```txt
Family / material
└── Size
    └── Shape variants
```

Each base model row exposes two direct actions:

```txt
+ spec
+ recette
```

These actions open modals. Specs and recipes are no longer permanent bottom tabs.

### Anchors

Anchor editing is simplified.

Workflow:

```txt
1. Click a voxel face in the 3D editor preview.
2. Click “Ajouter ancre sur face”.
3. The red anchor dot is placed at the center of that face.
4. To delete, select the same face and click “Supprimer ancre sur face”.
```

The anchor list remains available for inspection and fallback selection.

New anchors store their source voxel face in metadata:

```json
{
  "metadata": {
    "source": "editor_face_selection",
    "cell": { "x": 0, "y": 1, "z": 0 }
  }
}
```

### Specs

Specs are attached to the base model family/size, not to the assembly scene.

The editor opens specs from the tree row with `+ spec`.

### Recipes

Recipes follow the same pattern as specs.

The editor opens recipes from the tree row with `+ recette`.

### Shape editing

The editor preview keeps the 1x1x1 voxel representation.

Corrections such as chamfer, round, quarter round, half round, cut, and wedge remain stored in `shape_variant.generation.operations[]`.

## Build commands

Development/full internal build:

```bash
npm run build
```

Public assembly-only build:

```bash
npm run build:assembly
```
