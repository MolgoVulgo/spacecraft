# Editor Advanced Variants

Ce document existe uniquement pour acter la suppression du workflow legacy.

## Statut actuel

- le sélecteur `Simple / Advanced mesh` a été supprimé de l’Editor
- l’édition brute par `vertices` / `faces` n’est plus un workflow supporté
- `generation.mode = advanced_mesh` est obsolète
- l’Editor produit désormais des variantes via `voxel_grid` ou `parametric_shape`
- le mode avancé actuel repose sur les points, arêtes, faces draft et `generation.operations[]`

## Remplacement

Utiliser :

- `Mode normal` pour l’édition classique de la variante
- `Mode avancé` pour la grille de points, les arêtes draft, les faces draft, `custom_face` et `cut`

Ne pas réintroduire :

- `visual_mesh`
- édition brute de vertices/faces
- conversion du toggle UI vers `advanced_mesh`
