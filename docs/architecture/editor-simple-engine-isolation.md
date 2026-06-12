# Editor Simple Engine Isolation

## Phase 3 scope

- `src/3d/editor/variantSelection.js`
  - sélection des variantes et pièces liées à une base famille/taille
  - calcul des index de variantes encore disponibles
- `src/3d/editor/editorViewport.js`
  - calcul du plan de cadrage preview Editor
- `src/3d/editor/editorAnchors.js`
  - filtration des anchors affichables
- `src/3d/editor/editorSimpleMode.js`
  - dérivation de l’état de preview simple sans dépendance DOM

## Current split

- `src/editor.js`
  - orchestre UI, formulaires, modales, interactions et rendu Three
- `src/3d/editor/*`
  - porte les règles simples Editor isolables et testables

## Intentional limitation

- les workflows avancés vertex/face restent dans `src/editor.js` à ce stade.
