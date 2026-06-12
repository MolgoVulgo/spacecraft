# Editor Point Selection

## Phase 6 scope

- `src/3d/editor/editorPointSelection.js`
  - sélection simple et multi-sélection de points
  - normalisation des ids
  - reset propre de sélection

## Current behavior

- clic en mode avancé : sélection d’un point
- `Shift + clic` : ajoute un point à la sélection
- `Escape` : vide la sélection
- `Delete` / `Backspace` : vide uniquement la sélection UI
- changement de variante/base ou sortie du mode avancé : reset de sélection

## Non-goal

- aucune création de ligne ou de face dans cette phase.
