# SpaceCraft C1 Rich Catalog

Application web locale avec deux entrées séparées :

- `index.html` : Assembly public, catalogue verrouillé.
- `editor.html` : Éditeur interne catalogue, variantes, ancres, specs et recettes.

## Source catalogue unique

Le catalogue de référence est :

```txt
public/data/4x3x1_catalog.json
```

Assembly ne lit plus de copie `localStorage`. Il charge uniquement :

```txt
/data/4x3x1_catalog.json
```

En mode dev, `Publier vers Assembly` dans l’éditeur écrit directement `public/data/4x3x1_catalog.json` via l’endpoint Vite :

```txt
PUT /api/catalog/write
```

En build statique, l’écriture directe est impossible depuis le navigateur. Le bouton télécharge alors le JSON à replacer manuellement dans `public/data/4x3x1_catalog.json` avant rebuild.

## Commandes

```bash
npm install
npm run dev
npm run test
npm run build
npm run build:assembly
node scripts/validate-catalog.mjs public/data/4x3x1_catalog.json
```

Tests Python historiques uniquement :

```bash
npm run test:python:legacy
```

## Flux de travail

```txt
editor.html
→ créer / modifier variantes, ancres, specs, recettes
→ optionnel: mode avancé points / lignes / faces / coupe
→ contrôler / valider
→ Publier vers Assembly
→ recharger index.html
```

`index.html` utilise toujours le fichier catalogue publié, jamais un état navigateur persistant.

## Persistance locale des créations

Le catalogue reste statique et versionné dans `public/data/4x3x1_catalog.json`.

Les créations utilisateur sont maintenant stockées séparément :

```txt
catalogue officiel      -> /data/4x3x1_catalog.json
créations utilisateur   -> IndexedDB (base spacecraft_editor)
import / export         -> fichiers .spacecraft.json
```

Le format local canonique est `ShipCreation` :

```json
{
  "schema_version": 1,
  "catalog_version": "0.1.0",
  "local_id": "uuid",
  "name": "Unnamed",
  "created_at": "2026-06-10T12:00:00.000Z",
  "updated_at": "2026-06-10T12:00:00.000Z",
  "ship": {
    "pieces": [],
    "computed_specs": {}
  }
}
```

`index.html` expose maintenant :

```txt
Mes créations
-> nouveau / ouvrir / renommer / dupliquer / supprimer
-> autosave local
-> export JSON canonique
-> import JSON canonique
```

## Groupes Assembly

Assembly permet maintenant de créer des groupes logiques de pièces déjà placées.

```txt
sélection multiple dans "Pièces placées"
ou Shift + clic sur des pièces libres
-> Créer groupe
-> sélection / drag / hauteur / duplication / suppression comme un bloc
-> Dégrouper / Renommer groupe
```

Le moteur ne fusionne pas la géométrie : un groupe reste un conteneur logique persistant au-dessus des instances de pièces.

La création est refusée si les pièces sélectionnées ne forment pas un ensemble connecté par ancres compatibles.

La persistance catalogue navigateur reste interdite. Seules les créations de vaisseaux utilisent IndexedDB.

## Garde-fous techniques

Assembly utilise maintenant des modules dédiés pour les zones sensibles :

```txt
src/assembly-drag-controller.js  -> capture pointeur / drag caméra / routage interaction
src/assembly-movement.js         -> déplacements validés pièce/groupe/sélection
src/history/command-stack.js     -> undo / redo des déplacements
src/catalog-validator.js         -> validation contrat catalogue
src/scene-validator.js           -> validation contrat scène / groupes
```

Docs de référence :

```txt
docs/CURRENT_ARCHITECTURE.md
docs/DRIFT_CONTROL.md
docs/architecture/3d-engines.md
docs/editor/simple-mode.md
docs/editor/advanced-mode.md
docs/catalog/schema.md
```
