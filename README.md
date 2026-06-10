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
npm run build
npm run build:assembly
```

## Flux de travail

```txt
editor.html
→ créer / modifier variantes, ancres, specs, recettes
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

La persistance catalogue navigateur reste interdite. Seules les créations de vaisseaux utilisent IndexedDB.
