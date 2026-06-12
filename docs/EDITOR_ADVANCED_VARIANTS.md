# Editor Advanced Variants

`baseBox` reste la vérité métier.

- `baseBox` = dimensions catalogue, collision, snap, occupation grille.
- `visualMesh` = rendu uniquement.
- `anchors` = connecteurs logiques indépendants du rendu.

## Règles

- `collision.mode` doit rester `base_box` pour `advanced_mesh`.
- `generation.mode` peut valoir `advanced_mesh`.
- `generation.visual_mesh.vertices` contient des points dans la base logique.
- `generation.visual_mesh.faces` référence ces vertices par id.
- Les coordonnées doivent respecter le pas `grid_step`, par défaut `0.5`.
- Les ancres restent éditées dans l’espace logique de la `baseBox`.

## Exemple

```json
{
  "generation": {
    "mode": "advanced_mesh",
    "base": {
      "type": "box",
      "bounds": { "length": 4, "width": 3, "height": 1 }
    },
    "visual_mesh": {
      "grid_step": 0.5,
      "vertices": [
        { "id": "v001", "x": 0, "y": 0, "z": 0 },
        { "id": "v002", "x": 4, "y": 0, "z": 0 },
        { "id": "v003", "x": 4, "y": 2, "z": 0 },
        { "id": "v004", "x": 0, "y": 2, "z": 0 }
      ],
      "faces": [
        { "id": "f001", "vertices": ["v001", "v002", "v003", "v004"] }
      ]
    }
  },
  "collision": { "mode": "base_box" }
}
```

## Limitations V1

- Pas de décorations, decals, gravures ou reliefs secondaires.
- Triangulation en fan pour quads et n-gons simples.
- Suppression d’un vertex refusée s’il est encore utilisé par une face.
