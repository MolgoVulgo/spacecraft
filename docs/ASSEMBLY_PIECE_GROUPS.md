# ASSEMBLY_PIECE_GROUPS.md

## Scope

Cette note décrit le runtime de groupes côté `index.html` / `src/main.js`.

Le groupe est un conteneur logique :

```text
- pas de fusion géométrique
- pas de nouvelle entrée catalogue
- pas de modification du shape engine
```

## Données runtime

Assembly maintient maintenant :

```text
state.instances       -> toutes les pièces réelles
state.assemblyGroups  -> groupes logiques
```

Chaque groupe stocke :

```text
id
name
origin = coin min XYZ de la bbox
pivot = centre bbox
bbox
children[]
  - instanceId
  - localPosition
metadata
```

Chaque pièce groupée garde sa propre instance Three.js et son `catalogPieceId`, mais reçoit aussi :

```text
groupId
```

## UI Assembly

Dans `Pièces placées` :

```text
- les pièces libres restent listées individuellement
- les pièces groupées sont masquées
- le groupe apparaît comme une entrée unique
```

Sélection multiple :

```text
instanceSelect[multiple]
-> 2+ pièces libres
-> Créer groupe

Shift + clic dans la scène
-> ajoute / retire une pièce libre dans la multi-sélection
-> ne crée jamais le groupe automatiquement
```

Actions exposées :

```text
Créer groupe
Dégrouper
Renommer groupe
Dupliquer
Supprimer
Cadrer sélection
Ctrl + G = créer groupe
Ctrl + B = dissoudre groupe sélectionné
```

## Déplacement

Un clic sur une pièce enfant d’un groupe sélectionne le groupe.

Le drag agit sur `group.origin`.

Validation appliquée :

```text
- boxes enfants du groupe projetées en world
- collisions externes uniquement
- side-anchor snap d’abord
- auto-Z ensuite si nécessaire
```

## Persistance

`ShipCreation` inclut maintenant :

```text
ship.pieces[]
ship.groups[]
```

`ship.pieces[].group_id` relie une pièce à son groupe.

`ship.groups[]` conserve l’origine, la bbox et les offsets locaux enfants.

## Limitations actuelles

```text
- pas de groupes imbriqués
- pas de sauvegarde comme modèle catalogue réutilisable
- la symétrie de groupe reflète les offsets et les symétries enfants, sans nouveau type de transform dédié
```

## Validation de création

La création d’un groupe est refusée si toutes les pièces sélectionnées ne sont pas dans un même composant connecté par ancres compatibles.
