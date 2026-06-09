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
