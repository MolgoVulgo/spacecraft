# LOCAL_PERSISTENCE_INDEXEDDB.md

## Scope

Cette couche ajoute la persistance locale des créations de vaisseaux sans toucher à la source catalogue.

```text
Catalogue officiel  -> public/data/4x3x1_catalog.json
Créations locales   -> IndexedDB
Import / export     -> ShipCreation JSON
```

## Modules

```text
src/ship-creation.js
src/storage/localDb.js
src/storage/shipRepository.js
src/storage/storageAvailability.js
src/assembly-persistence-controller.js
```

## Modèle canonique

Le format unique de sauvegarde, chargement, import et export est `ShipCreation`.

Champs requis :

```text
schema_version
catalog_version
local_id
name
created_at
updated_at
ship.pieces
ship.groups
ship.computed_specs
```

Chaque pièce placée stocke :

```text
placed_piece_id
catalog_piece_id
family_id
size_id
shape_variant_id
spec_profile_id
recipe_id
position
rotation
symmetry
material
anchor_links
components
modifiers
group_id
```

Chaque groupe stocke :

```text
group_id
type = group
name
origin
pivot
bbox
children[instance_id, local_position]
metadata
```

## IndexedDB

```text
database: spacecraft_editor
version : 1
stores  :
  ships     -> keyPath local_id, indexes updated_at/name
  app_meta  -> keyPath key
```

Clés `app_meta` actuelles :

```text
last_opened_ship_id
storage_schema_version
```

## Autosave

Règles appliquées :

```text
dirty state
-> debounce 700 ms
-> save repository
-> UI status update
```

Triggers câblés en Assembly :

```text
ajout de pièce
duplication de pièce
duplication de groupe
suppression de pièce
suppression de groupe
création de groupe
dégrouper
vidage de scène
fin de drag avec déplacement réel
changement de symétrie
changement de forme
changement de couleur
changement de hauteur
renommage de création
```

## UI Assembly

La carte `Mes créations` permet :

```text
nouveau
ouvrir
renommer
dupliquer
supprimer
exporter
importer
```

Le bouton `Exporter création` de la barre Assembly exporte aussi le `ShipCreation` canonique.

## Limitations actuelles

```text
- pas de backend de partage
- pas de preview image des créations
- pas de migration cross-catalog automatique
- import tolère un catalog_version différent mais l’indique en warning
```
