# Editor Edges

## Phase 7 scope

- `src/3d/editor/editorEdges.js`
  - création de lignes draft depuis 2 points sélectionnés
  - refus des doublons
  - validation des points contre la grille active

## Current behavior

- `L` en mode avancé avec 2 points sélectionnés crée une ligne
- moins de 2 points : refus
- plus de 2 points : refus
- doublon : refus
- les lignes sont gardées dans l’état runtime par `shapeId`

## Non-goal

- aucune création de face dans cette phase.
