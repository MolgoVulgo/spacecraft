# Analyse de la partie Python

Ce document décrit le fonctionnement actuel de l'éditeur Python situé dans `tools/`.
Il s'appuie sur le code réel, principalement `tools/main.py`, `tools/piece_editor/models.py`, `tools/piece_editor/storage.py` et `tools/piece_editor/grid.py`.

## Vue d'ensemble

La partie Python est un prototype d'édition et d'assemblage 3D basé sur Ursina.

Elle repose sur une séparation simple :

- `tools/main.py` pilote l'application, l'UI, les raccourcis clavier, le rendu et les deux modes de travail ;
- `tools/piece_editor/models.py` contient le modèle métier : pièce logique, cellules d'ancrage, instances, miroirs, bornes et collision ;
- `tools/piece_editor/storage.py` charge le catalogue JSON et sauvegarde une pièce ;
- `tools/piece_editor/grid.py` construit la grille visuelle ;
- `tools/data/pieces.json` contient le catalogue initial.

Le projet ne contient pas de backend, pas de synchronisation avec le viewer web, et pas de persistance de scène d'assemblage.

## Modèle de données

### Pièce logique

Une `Piece` contient :

- `id`
- `name`
- `logical_size`
- `anchor_cells`

`logical_size` est l'enveloppe autoritaire de la pièce. Les `anchor_cells` sont des cellules internes, pas la taille réelle de la pièce.

Exemple de forme attendue :

```json
{
  "id": "standard_4x3x1",
  "name": "Standard 4x3x1",
  "logical_size": [4, 3, 1],
  "anchor_cells": [[0, 0, 0]]
}
```

Le code force les tailles minimales à `1x1x1` et supprime automatiquement les cellules d'ancrage hors limites après redimensionnement.

### Instance en assemblage

Une `PieceInstance` contient :

- un identifiant numérique ;
- une copie de `Piece` ;
- une position logique `(x, y, z)` ;
- trois booléens indépendants de miroir :
  - `mirror_length`
  - `mirror_width`
  - `mirror_height`
- une couleur logique (`color_name`).

Les miroirs n'affectent pas l'enveloppe logique. Ils ne transforment que les cellules d'ancrage calculées pour l'instance.

## Système de coordonnées

Le projet garde les coordonnées logiques suivantes :

- `x` = longueur
- `y` = largeur
- `z` = hauteur

Dans Ursina, le rendu mappe ces axes ainsi :

- scène `X` = longueur logique
- scène `Y` = hauteur logique
- scène `Z` = largeur logique

Cette conversion est centralisée dans :

- `to_scene_cell_center`
- `to_scene_box_center`
- `to_scene_box_scale`

## Chargement et sauvegarde

Au démarrage, le contrôleur charge `tools/data/pieces.json` via `load_catalog`.

Si le catalogue est vide, une pièce de secours `empty_4x3x1` est créée en mémoire.

La sauvegarde actuelle écrit uniquement la pièce courante dans :

`tools/data/user_piece.json`

La sauvegarde n'insère pas la pièce dans `pieces.json`, ne fusionne pas le catalogue, et ne recharge pas automatiquement cette pièce au prochain démarrage.

## Modes de fonctionnement

L'application a deux modes.

### Mode édition

Le mode édition sert à travailler sur une seule définition de pièce.

Fonctions implémentées :

- sélectionner la pièce courante dans le catalogue avec `Prev piece` / `Next piece` ;
- créer une nouvelle pièce vide `4x3x1` avec `New 4x3x1` ;
- redimensionner l'enveloppe logique sur longueur, largeur, hauteur ;
- déplacer un curseur interne cellule par cellule ;
- activer ou désactiver une cellule d'ancrage sous le curseur ;
- appliquer un miroir directement aux `anchor_cells` de la pièce courante ;
- sauvegarder la pièce courante dans `user_piece.json`.

Le rendu montre :

- le volume complet de la pièce ;
- les cellules d'ancrage ;
- le curseur actif.

### Mode assemblage

Le mode assemblage sert à poser plusieurs instances dans une scène commune.

Fonctions implémentées :

- ajouter une instance à partir de la pièce courante ;
- sélectionner cycliquement les instances avec `Tab` ;
- déplacer l'instance sélectionnée sur les 3 axes ;
- appliquer des miroirs indépendants à l'instance sélectionnée ;
- supprimer l'instance sélectionnée ;
- empêcher les chevauchements logiques.

Chaque instance ajoutée reçoit une couleur parmi une petite liste fixe.

## Collision

La collision passe par `bounds_overlap(a, b)`.

Le test utilise des comparaisons strictes :

```python
ax1 < bx2 and ax2 > bx1
```

Cela signifie :

- le contact bord à bord est autorisé ;
- le contact face à face est autorisé ;
- le contact coin à coin est autorisé ;
- toute intersection avec volume positif est refusée.

La collision s'appuie sur l'enveloppe logique entière de la pièce, pas sur les cellules d'ancrage.

## Rendu et interface

L'interface est entièrement construite dans `Controller._build_ui()`.

Le menu est fixé à gauche et expose des boutons pour :

- changer de mode ;
- parcourir le catalogue ;
- créer une nouvelle pièce ;
- sauvegarder ;
- redimensionner ;
- ajouter une instance ;
- appliquer les trois miroirs ;
- afficher ou masquer la grille ;
- recentrer la scène ;
- supprimer l'instance sélectionnée.

Le rendu d'une pièce est volontairement simple :

- un cube plein pour l'enveloppe logique ;
- des petits cubes pour les cellules d'ancrage ;
- des cubes fins pour simuler les arêtes.

Il n'y a pas de mesh métier spécifique par pièce dans cette partie Python.

## Raccourcis clavier actuels

Les raccourcis effectivement implémentés sont :

- `F1` : mode édition
- `F2` : mode assemblage
- `Tab` : instance suivante
- `Space` : activer/désactiver une cellule d'ancrage au curseur
- `Ctrl+S` : sauvegarder la pièce courante
- `Delete` : supprimer l'instance sélectionnée
- `C` : recentrer la caméra
- `A` / `D` : déplacer sur la longueur
- `W` / `S` : déplacer sur la largeur
- `Q` / `E` : déplacer sur la hauteur
- `x` / `y` / `z` : réduire la taille sur un axe
- `X` / `Y` / `Z` : agrandir la taille sur un axe

## Limitations actuelles

### Limites fonctionnelles

- Il n'y a pas de sélection d'instance à la souris. La sélection passe par `Tab`.
- Il n'y a pas de déplacement à la souris en assemblage.
- Il n'y a pas de liste UI des instances présentes dans la scène.
- Il n'y a pas d'édition de couleur utilisateur malgré la présence d'une palette interne.
- Il n'y a pas de renommage d'une pièce depuis l'interface.
- La commande `Save piece` écrit un fichier isolé `user_piece.json`, sans mise à jour du catalogue principal.
- Il n'y a pas de chargement automatique d'une pièce utilisateur sauvegardée.
- Il n'y a pas de sauvegarde/restauration de scène d'assemblage.
- Il n'y a pas de rotation libre ni de système d'orientation.
- Il n'y a pas de snapping avancé par ancres ; les ancres sont seulement visualisées et transformées.

### Limites de robustesse

- `load_catalog` n'a pas de gestion d'erreur locale : fichier absent ou JSON invalide provoquera une erreur au démarrage.
- La sauvegarde écrit un seul objet JSON de pièce, alors que le catalogue principal utilise une enveloppe `{ "pieces": [...] }`. Le format est cohérent pour une pièce isolée, mais pas directement réinjectable tel quel dans `pieces.json`.
- `flash_message` passe par `print`, donc le retour utilisateur reste minimal et non persistant.
- Plusieurs `try/except Exception` existent côté UI Ursina pour masquer des variations de runtime, ce qui évite certains plantages d'interface mais réduit la précision du diagnostic.

### Limites produit

- Le projet reste un prototype visuel et logique, pas un éditeur complet de catalogue.
- Le rendu n'exprime pas des formes de pièces spécialisées ; il montre seulement leur enveloppe logique et leurs ancres.
- Le flux entre l'éditeur Python et le viewer web n'est pas automatisé.

## Écart entre intention et état réel

Quelques points prévus dans les consignes globales ne sont pas encore présents dans l'implémentation Python actuelle :

- pas de sélection visuelle directe d'une instance dans la scène ;
- pas de contrôle `PageUp` / `PageDown` pour la hauteur, la hauteur se déplace avec `Q` / `E` ;
- pas de gestion d'une liste d'instances dans le panneau ;
- pas de persistance d'assemblage ;
- pas de logique d'attache basée sur ancres.

## Conclusion

La partie Python actuelle est un éditeur logique minimal couplé à un assembleur simple :

- l'enveloppe logique est bien la source d'autorité ;
- les ancres restent internes à cette enveloppe ;
- les collisions sont simples, strictes et prévisibles ;
- les trois miroirs d'instance sont indépendants ;
- l'UI couvre les opérations essentielles du prototype.

Sa principale limite actuelle n'est pas la logique métier de base, qui est cohérente, mais l'absence de persistance riche, de sélection/manipulation directe dans la scène, et d'intégration plus fluide avec le catalogue et le viewer web.
