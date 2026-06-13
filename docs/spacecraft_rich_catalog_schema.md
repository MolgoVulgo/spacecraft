# SpaceCraft Rich Catalog JSON Schema

## Purpose

This document defines the target JSON structure for the offline ship planner.

The goal is not to reproduce game assets with 100% visual fidelity. The goal is to represent the real in-game catalog with enough structural, geometric, statistical, and crafting data to let users build ships offline with coherent constraints.

The JSON must be rich from the start, even when many values are still unknown. Missing data must be represented explicitly with `null`, empty arrays, or `status: "unknown"` fields instead of forcing future destructive refactors.

---

## Core Rules

### 1. Closed game catalog

Pieces are fixed by the game catalog. The app must not generate arbitrary sizes.

Allowed structure:

```txt
functional family
└── part type
    └── material / technology
        └── size
            └── shape variant
                └── technical profile
```

A playable catalog entry is not only a size. A real part is identified by:

```txt
family + size + shape_variant + spec_profile
```

Example:

```txt
Steel 4x3x1, shape variant 03, thermal profile
```

### 2. Separate concepts

Do not merge these concepts:

```txt
functional_family  -> category and allowed rules
part_type          -> functional identity inside a family
material           -> material/technology identity
size              -> fixed dimensions
shape_variant     -> geometry / silhouette
symmetry_state     -> orientation transform
placement_rules    -> orientation/mount/zone constraints
spec_profile       -> stats
recipe             -> crafting data
placed_piece        -> instance in a ship
```

Migration rule:

```txt
missing type_id           -> legacy structural piece
missing placement_rules   -> current structural behavior
shape.allowed_symmetry    -> fallback if placement_rules.allowed_symmetry is absent
```

### 3. Shape fidelity target

The shape is simplified but must remain functionally recognizable.

Ignore:

```txt
textures
screws
panels
decorative reliefs
micro details
surface decals
```

Preserve:

```txt
real size
main silhouette
main slopes
structural rounded forms
visible chamfers
collisions
anchors
symmetry behavior
```

### 4. Geometry unit conventions

Use a geometry grid that supports half units.

```txt
main unit: 1
sub-unit: 0.5
common rounded shape: 1x1
common chamfer: 0.5x0.5
```

Rounded structural shapes must not be reduced to square corners when the round form defines the piece.

### 5. Variants are not symmetries

Shape variants are catalog forms.

Symmetries are independent transforms applied to a canonical shape.

```txt
shape_variant = form
symmetry_state = orientation
```

The three in-game symmetry buttons must be modeled independently:

```txt
length symmetry
width symmetry
height symmetry
```

A symmetry toggle must not reset the others.

### 6. Recompute from canonical shape

Never apply geometry transforms destructively.

Correct flow:

```txt
canonical shape
+ symmetry state
+ rotation
+ position
= rendered / placed geometry
```

This avoids drift, anchor errors, collision errors, and order-dependent behavior.

---

## Top-Level JSON Layout

Recommended catalog file:

```json
{
  "schema_version": "0.1.0",
  "game": {
    "id": "spacecraft",
    "catalog_status": "partial",
    "source": "manual_game_capture"
  },
  "units": {
    "grid_unit": 1,
    "subgrid_unit": 0.5,
    "mass": "t",
    "system_support": "SP",
    "thermal_capacity": "MJ/K",
    "thermal_conductivity": "W/aK",
    "decoration_capacity": "DP",
    "craft_duration": "su"
  },
  "definitions": {
    "spec_fields": {},
    "symmetry_axes": {},
    "shape_operation_types": {},
    "anchor_types": {}
  },
  "sizes": [],
  "families": [],
  "shape_variants": [],
  "spec_profiles": [],
  "recipes": [],
  "catalog_pieces": [],
  "ship_blueprint_schema": {}
}
```

---

## Definitions

### Spec Fields

```json
{
  "definitions": {
    "spec_fields": {
      "system_support": {
        "label_fr": "Apport système",
        "unit": "SP",
        "aggregation": "sum",
        "description_fr": "Nombre de systèmes secondaires disponibles pour alimenter les modules du vaisseau."
      },
      "chassis": {
        "label_fr": "Châssis",
        "unit": null,
        "aggregation": "sum",
        "description_fr": "Capacité structurelle du vaisseau à ne pas se briser sous son propre poids."
      },
      "mass": {
        "label_fr": "Masse",
        "unit": "t",
        "aggregation": "sum",
        "description_fr": "Masse totale ajoutée par la pièce."
      },
      "fuselage": {
        "label_fr": "Fuselage",
        "unit": null,
        "aggregation": "sum",
        "description_fr": "Résistance globale du vaisseau. À zéro, le vaisseau est hors service et doit être dépanné."
      },
      "thermal_capacity": {
        "label_fr": "Capacité thermique",
        "unit": "MJ/K",
        "aggregation": "sum",
        "description_fr": "Quantité d'énergie requise pour augmenter la température du vaisseau."
      },
      "thermal_conductivity": {
        "label_fr": "Conductibilité thermique de matériau",
        "unit": "W/aK",
        "aggregation": "weighted_average",
        "weighted_by": "mass",
        "description_fr": "Vitesse de transfert thermique du matériau."
      },
      "decoration_capacity": {
        "label_fr": "Capacité de décoration",
        "unit": "DP",
        "aggregation": "sum",
        "description_fr": "Capacité décorative disponible."
      }
    }
  }
}
```

Thermal conductivity must not be summed blindly. Use a dedicated aggregation rule, initially `weighted_average` by mass unless later game validation proves otherwise.

---

## Sizes

Sizes define fixed game dimensions.

```json
{
  "id": "4x3x1",
  "label": "4x3x1",
  "dimensions": {
    "length": 4,
    "width": 3,
    "height": 1
  },
  "status": "confirmed"
}
```

Known examples from captures:

```json
[
  { "id": "4x3x1", "label": "4x3x1", "dimensions": { "length": 4, "width": 3, "height": 1 }, "status": "confirmed" },
  { "id": "6x3x1", "label": "6x3x1", "dimensions": { "length": 6, "width": 3, "height": 1 }, "status": "confirmed" },
  { "id": "8x3x1", "label": "8x3x1", "dimensions": { "length": 8, "width": 3, "height": 1 }, "status": "confirmed" },
  { "id": "4x3x2", "label": "4x3x2", "dimensions": { "length": 4, "width": 3, "height": 2 }, "status": "confirmed" },
  { "id": "6x3x2", "label": "6x3x2", "dimensions": { "length": 6, "width": 3, "height": 2 }, "status": "confirmed" },
  { "id": "8x3x2", "label": "8x3x2", "dimensions": { "length": 8, "width": 3, "height": 2 }, "status": "confirmed" },
  { "id": "8x6x2", "label": "8x6x2", "dimensions": { "length": 8, "width": 6, "height": 2 }, "status": "confirmed" },
  { "id": "12x6x2", "label": "12x6x2", "dimensions": { "length": 12, "width": 6, "height": 2 }, "status": "confirmed" },
  { "id": "16x6x2", "label": "16x6x2", "dimensions": { "length": 16, "width": 6, "height": 2 }, "status": "confirmed" }
]
```

---

## Families

A family represents the in-game material / part family.

```json
{
  "id": "steel",
  "label_fr": "Acier",
  "group_label_fr": "Acier",
  "category": "ship_part",
  "subcategory": "fuselage_part",
  "status": "partial"
}
```

Known family examples:

```json
[
  {
    "id": "steel",
    "label_fr": "Acier",
    "category": "ship_part",
    "subcategory": "fuselage_part",
    "status": "partial"
  },
  {
    "id": "steel_thermal",
    "label_fr": "Acier thermique",
    "base_family_id": "steel",
    "category": "ship_part",
    "subcategory": "fuselage_part",
    "profile_hint": "thermal",
    "status": "partial"
  },
  {
    "id": "titanium_superior",
    "label_fr": "Titane supérieur",
    "category": "ship_part",
    "subcategory": "fuselage_part",
    "status": "partial"
  },
  {
    "id": "solid_chassis",
    "label_fr": "Châssis solide",
    "category": "ship_part",
    "subcategory": "fuselage_part",
    "status": "partial"
  },
  {
    "id": "levinium",
    "label_fr": "Lévinium",
    "category": "ship_part",
    "subcategory": "fuselage_part",
    "status": "partial"
  }
]
```

---

## Shape Variants

A shape variant defines geometry only.

It must not contain stats, recipe data, or placed-instance data.

### Direct primitive mode

```json
{
  "id": "shape_4x3x1_v01",
  "size_id": "4x3x1",
  "variant_index": 1,
  "label": "4x3x1 variant 01",
  "shape_family": "rounded_block",
  "simplified": true,
  "fidelity": {
    "target": "functional_silhouette",
    "ignore_cosmetic_details": true
  },
  "generation": {
    "mode": "primitive_stack",
    "base": {
      "type": "box",
      "bounds": { "length": 4, "width": 3, "height": 1 }
    },
    "operations": [
      {
        "type": "round",
        "target": "front_left_corner",
        "radius": 1.0,
        "segments": 4
      },
      {
        "type": "chamfer",
        "target": "front_right_edge",
        "size": 0.5
      }
    ]
  },
  "allowed_symmetry": {
    "length": true,
    "width": true,
    "height": true
  },
  "anchors": [],
  "collision": {
    "mode": "generated_from_shape",
    "precision": "simplified"
  },
  "status": "draft"
}
```

### Layered mode

A 4x3x2 part can sometimes be modeled as stacked 4x3x1 layers.

```json
{
  "id": "shape_4x3x2_v03",
  "size_id": "4x3x2",
  "variant_index": 3,
  "shape_family": "layered_block",
  "simplified": true,
  "generation": {
    "mode": "layered",
    "layers": [
      {
        "z": 0,
        "height": 1,
        "shape_ref": "shape_4x3x1_v01"
      },
      {
        "z": 1,
        "height": 1,
        "shape_ref": "shape_4x3x1_v04"
      }
    ]
  },
  "allowed_symmetry": {
    "length": true,
    "width": true,
    "height": true
  },
  "anchors": [],
  "collision": {
    "mode": "generated_from_shape",
    "precision": "simplified"
  },
  "status": "draft"
}
```

### Continuous slope mode

Do not force full slopes into layers.

```json
{
  "id": "shape_4x3x2_v07",
  "size_id": "4x3x2",
  "variant_index": 7,
  "shape_family": "full_slope",
  "simplified": true,
  "generation": {
    "mode": "primitive_stack",
    "base": {
      "type": "wedge",
      "bounds": { "length": 4, "width": 3, "height": 2 },
      "slope_axis": "length",
      "slope_direction": "front_to_back"
    },
    "operations": []
  },
  "allowed_symmetry": {
    "length": true,
    "width": true,
    "height": true
  },
  "anchors": [],
  "collision": {
    "mode": "generated_from_shape",
    "precision": "simplified"
  },
  "status": "draft"
}
```

---

## Shape Operation Types

The generator must support a limited set of shape operations.

```json
{
  "definitions": {
    "shape_operation_types": {
      "box": {
        "description": "Full rectangular block."
      },
      "wedge": {
        "description": "Main sloped volume."
      },
      "cut": {
        "description": "Simple planar cut."
      },
      "chamfer": {
        "description": "0.5x0.5 visible chamfer."
      },
      "round": {
        "description": "Rounded structural form, commonly radius 1."
      },
      "quarter_round": {
        "description": "Quarter rounded corner approximation."
      },
      "half_round": {
        "description": "Half rounded side approximation."
      },
      "layer": {
        "description": "Vertical composition layer."
      }
    }
  }
}
```

Implementation constraint:

```txt
Do not implement a free mesh editor.
Implement controlled parametric shape operations only.
```

---

## Symmetry Model

Symmetry state is instance-level, not catalog-level.

The shape defines what is allowed:

```json
{
  "allowed_symmetry": {
    "length": true,
    "width": true,
    "height": true
  }
}
```

Placed pieces store the active state:

```json
{
  "symmetry": {
    "length": false,
    "width": true,
    "height": false
  }
}
```

Transform rule:

```txt
canonical shape -> apply active symmetries -> apply rotation -> apply position
```

Anchors and collisions must be transformed using the same transformation pipeline.

---

## Anchors

Anchors are attachment points. They are not simple hidden cells.

Visual editor requirement:

```txt
anchors must be displayed as small red dots on exposed faces
```

Anchor schema:

```json
{
  "id": "anchor_001",
  "position": {
    "x": 0.5,
    "y": 1.5,
    "z": 1.0
  },
  "normal": {
    "x": -1,
    "y": 0,
    "z": 0
  },
  "face": "left",
  "type": "standard",
  "enabled": true,
  "status": "draft"
}
```

Rules:

```txt
anchors belong to the canonical shape
anchors must be transformed with symmetry / rotation
anchors must be validated against the generated exposed faces
anchors must not be stored as invisible internal blocks
```

---

## Collision

Collision must follow simplified functional geometry, not only the bounding box.

```json
{
  "collision": {
    "mode": "generated_from_shape",
    "precision": "simplified",
    "allow_overlap": false
  }
}
```

Rules:

```txt
pieces cannot overlap
slopes use sloped collision
rounded forms use simplified rounded collision
chamfers use chamfered collision
layered parts use layer-composed collision
```

---

## Spec Profiles

A spec profile contains the technical values used for ship score calculations.

It is linked to a family and size, and may represent a standard or upgraded version.

### Standard steel example

```json
{
  "id": "spec_steel_4x3x1_standard",
  "family_id": "steel",
  "size_id": "4x3x1",
  "profile_type": "standard",
  "label_fr": "Acier 4x3x1",
  "specs": {
    "system_support": { "value": 96, "unit": "SP", "status": "confirmed" },
    "chassis": { "value": 40, "unit": null, "status": "confirmed" },
    "mass": { "value": 20.0, "unit": "t", "status": "confirmed" },
    "fuselage": { "value": 10, "unit": null, "status": "confirmed" },
    "thermal_capacity": { "value": 20, "unit": "MJ/K", "status": "confirmed" },
    "thermal_conductivity": { "value": 60.0, "unit": "W/aK", "status": "confirmed" },
    "decoration_capacity": { "value": 4.0, "unit": "DP", "status": "confirmed" }
  }
}
```

### Thermal steel example

```json
{
  "id": "spec_steel_4x3x1_thermal",
  "family_id": "steel_thermal",
  "base_family_id": "steel",
  "size_id": "4x3x1",
  "profile_type": "thermal",
  "label_fr": "Acier thermique 4x3x1",
  "inherits_from": "spec_steel_4x3x1_standard",
  "specs": {
    "thermal_conductivity": { "value": 40.0, "unit": "W/aK", "status": "confirmed" }
  }
}
```

If `inherits_from` is used, the application must resolve the complete effective profile before ship stat calculation.

---

## Recipes

Recipes are separate from stats and shape.

### Standard recipe

```json
{
  "id": "recipe_steel_4x3x1_standard",
  "output_spec_profile_id": "spec_steel_4x3x1_standard",
  "cost": {
    "value": 800,
    "currency": "C",
    "status": "confirmed"
  },
  "duration": {
    "value": 20,
    "unit": "su",
    "status": "confirmed"
  },
  "station": {
    "id": "workshop",
    "label_fr": "Atelier",
    "status": "confirmed"
  },
  "ingredients": [
    {
      "item_id": "small_steel_part_casing",
      "label_fr": "Petit carter de pièce en acier",
      "quantity": 2,
      "status": "confirmed"
    },
    {
      "item_id": "connection_material",
      "label_fr": "Matériel de raccordement",
      "quantity": 2,
      "status": "confirmed"
    }
  ]
}
```

### Upgrade recipe

```json
{
  "id": "recipe_steel_4x3x1_thermal",
  "output_spec_profile_id": "spec_steel_4x3x1_thermal",
  "cost": {
    "value": 890,
    "currency": "C",
    "status": "confirmed"
  },
  "duration": {
    "value": 20,
    "unit": "su",
    "status": "confirmed"
  },
  "station": {
    "id": "workshop",
    "label_fr": "Atelier",
    "status": "confirmed"
  },
  "ingredients": [
    {
      "item_id": "steel_4x3x1_standard",
      "label_fr": "Acier 4x3x1",
      "quantity": 1,
      "status": "confirmed"
    },
    {
      "item_id": "thermal_plate",
      "label_fr": "Plaque thermique",
      "quantity": 4,
      "status": "confirmed"
    }
  ]
}
```

---

## Catalog Pieces

A catalog piece links family, size, shape variant, spec profile, and recipe.

It is the selectable item in the planner catalog.

### Standard steel catalog entry

```json
{
  "id": "piece_steel_4x3x1_v01_standard",
  "label_fr": "Acier 4x3x1",
  "family_id": "steel",
  "size_id": "4x3x1",
  "shape_variant_id": "shape_4x3x1_v01",
  "spec_profile_id": "spec_steel_4x3x1_standard",
  "recipe_id": "recipe_steel_4x3x1_standard",
  "fixed_catalog_entry": true,
  "availability": {
    "status": "unknown",
    "unlock": null
  },
  "metadata": {
    "source": "manual_capture",
    "notes": []
  }
}
```

### Thermal steel catalog entry

Same shape, different specs and recipe.

```json
{
  "id": "piece_steel_4x3x1_v01_thermal",
  "label_fr": "Acier thermique 4x3x1",
  "family_id": "steel_thermal",
  "base_family_id": "steel",
  "size_id": "4x3x1",
  "shape_variant_id": "shape_4x3x1_v01",
  "spec_profile_id": "spec_steel_4x3x1_thermal",
  "recipe_id": "recipe_steel_4x3x1_thermal",
  "fixed_catalog_entry": true,
  "availability": {
    "status": "unknown",
    "unlock": null
  },
  "metadata": {
    "source": "manual_capture",
    "notes": [
      "Same geometry as standard steel, different technical profile."
    ]
  }
}
```

---

## Placed Piece Instance

A ship blueprint must reference catalog pieces, not duplicate catalog data.

```json
{
  "id": "placed_001",
  "catalog_piece_id": "piece_steel_4x3x1_v01_thermal",
  "position": {
    "x": 0,
    "y": 0,
    "z": 0
  },
  "rotation": {
    "axis": "height",
    "quarter_turns": 0
  },
  "symmetry": {
    "length": false,
    "width": false,
    "height": false
  },
  "anchor_links": [],
  "metadata": {
    "locked": false,
    "notes": []
  }
}
```

---

## Ship Blueprint Schema

```json
{
  "ship_blueprint_schema": {
    "id": "ship_blueprint",
    "version": "0.1.0",
    "fields": {
      "name": "string",
      "placed_pieces": "array",
      "computed_stats": "object",
      "metadata": "object"
    }
  }
}
```

Example:

```json
{
  "id": "ship_test_001",
  "name": "Draft Ship",
  "schema_version": "0.1.0",
  "placed_pieces": [
    {
      "id": "placed_001",
      "catalog_piece_id": "piece_steel_4x3x1_v01_standard",
      "position": { "x": 0, "y": 0, "z": 0 },
      "rotation": { "axis": "height", "quarter_turns": 0 },
      "symmetry": { "length": false, "width": false, "height": false },
      "anchor_links": []
    }
  ],
  "computed_stats": {
    "system_support": 96,
    "chassis": 40,
    "mass": 20.0,
    "fuselage": 10,
    "thermal_capacity": 20,
    "thermal_conductivity": 60.0,
    "decoration_capacity": 4.0
  },
  "metadata": {
    "created_with": "offline_planner",
    "notes": []
  }
}
```

---

## Stat Calculation Rules

Initial rules:

```txt
system_support         -> sum
chassis                -> sum
mass                   -> sum
fuselage               -> sum
thermal_capacity       -> sum
decoration_capacity    -> sum
thermal_conductivity   -> weighted average by mass
```

Pseudo-code:

```txt
for each placed_piece:
  catalog_piece = catalog[catalog_piece_id]
  spec_profile = resolve_spec_profile(catalog_piece.spec_profile_id)
  add stats according to definitions.spec_fields[*].aggregation
```

Inheritance resolution:

```txt
if spec_profile.inherits_from:
  base = resolve_spec_profile(inherits_from)
  effective = merge(base, spec_profile.specs override)
else:
  effective = spec_profile.specs
```

---

## Validation Rules

### Catalog validation

Required checks:

```txt
catalog_piece.family_id exists
catalog_piece.size_id exists
catalog_piece.shape_variant_id exists
catalog_piece.spec_profile_id exists
catalog_piece.recipe_id exists or is null with status unknown
shape_variant.size_id == catalog_piece.size_id
spec_profile.size_id == catalog_piece.size_id
```

### Shape validation

Required checks:

```txt
shape bounds must not exceed size dimensions
operations must use valid operation types
chamfer sizes must be multiples of 0.5
round radius should normally be 1.0 unless explicitly documented
layered shapes must total the target height
anchors must be on exposed generated faces
collision must be generated after shape operations
```

### Symmetry validation

Required checks:

```txt
disabled symmetry button must not be usable
symmetry toggles must be independent
double toggle on same axis returns to original state
anchors and collisions must transform with geometry
```

### Blueprint validation

Required checks:

```txt
all placed_piece.catalog_piece_id must exist
pieces must not overlap
anchor links must connect compatible exposed anchors
computed stats must match catalog specs
```

---

## Editor Requirements

The editor must support catalog enrichment.

### Variant editor

Must support:

```txt
select size
create shape variant
choose primitive mode or layered mode
add limited operations
preview canonical shape
preview all enabled symmetry states
place/edit anchors as red dots on exposed faces
validate collision
save shape_variant
```

Must not support:

```txt
free mesh editing
decorative surface modeling
texture reproduction
export to game
```

### Specs editor

Must support:

```txt
edit family/size spec profiles
create upgraded spec profiles
inherit from standard profile
override only changed fields
mark values as confirmed / draft / unknown
```

### Recipe editor

Must support:

```txt
cost
duration
station
ingredients
output profile
status per value
```

### Catalog browser

Must group pieces by:

```txt
family
size
shape variant
technical profile
```

Filtering must allow:

```txt
family
size
shape family
profile type
confirmed / draft / unknown data
```

---

## Migration Strategy

The existing `4x3x1_catalog.json` must not remain a flat geometry-only file.

Migration phases:

### Phase 1 — Introduce schema shell

Create the top-level structure:

```txt
schema_version
units
definitions
sizes
families
shape_variants
spec_profiles
recipes
catalog_pieces
```

Populate only confirmed sizes and partial families.

### Phase 2 — Move existing geometry

Move current shape data into `shape_variants`.

Add:

```txt
size_id
variant_index
generation.mode
allowed_symmetry
collision
anchors
status
```

### Phase 3 — Create placeholder spec profiles

For every known family/size, create a profile with known values or `null`.

Use:

```json
{ "value": null, "unit": "SP", "status": "unknown" }
```

### Phase 4 — Add catalog pieces

Link:

```txt
family_id + size_id + shape_variant_id + spec_profile_id
```

### Phase 5 — Add recipe placeholders

Add recipes with known values where screenshots exist, otherwise placeholders.

### Phase 6 — Add validation tests

Automated tests must verify references, sizes, specs, shape operations, and blueprint stats.

---

## Minimal Valid Placeholder Example

When data is unknown, use explicit placeholders:

```json
{
  "id": "spec_titanium_superior_8x3x2_standard",
  "family_id": "titanium_superior",
  "size_id": "8x3x2",
  "profile_type": "standard",
  "label_fr": "Titane 8x3x2",
  "specs": {
    "system_support": { "value": null, "unit": "SP", "status": "unknown" },
    "chassis": { "value": null, "unit": null, "status": "unknown" },
    "mass": { "value": null, "unit": "t", "status": "unknown" },
    "fuselage": { "value": null, "unit": null, "status": "unknown" },
    "thermal_capacity": { "value": null, "unit": "MJ/K", "status": "unknown" },
    "thermal_conductivity": { "value": null, "unit": "W/aK", "status": "unknown" },
    "decoration_capacity": { "value": null, "unit": "DP", "status": "unknown" }
  }
}
```

---

## Implementation Notes for Codex

Use stable IDs. Do not generate labels as IDs dynamically at runtime.

Recommended ID patterns:

```txt
size:              4x3x1
family:            steel
shape_variant:     shape_4x3x1_v01
spec_profile:      spec_steel_4x3x1_standard
recipe:            recipe_steel_4x3x1_standard
catalog_piece:     piece_steel_4x3x1_v01_standard
placed_piece:      placed_001
```

Required internal services:

```txt
CatalogRepository
ShapeVariantRepository
SpecProfileResolver
RecipeRepository
ShipBlueprintStore
ShipStatsCalculator
ShapeGenerator
SymmetryTransformer
CollisionValidator
AnchorTransformer
```

Required automated checks:

```txt
JSON schema validation
reference integrity validation
shape bounds validation
spec profile inheritance validation
recipe output validation
ship stat calculation validation
collision validation on sample blueprints
symmetry transform round-trip validation
```

---

## Final Target Model

```txt
closed game catalog
+ fixed sizes
+ up to 13 shape variants per size
+ simplified but faithful geometry
+ structural rounds and chamfers
+ independent symmetry toggles
+ family/size spec profiles
+ upgraded technical profiles
+ recipe data
+ placed piece instances
+ computed ship scores
= coherent offline ship planner
```
