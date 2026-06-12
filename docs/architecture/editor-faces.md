# Editor Faces

## Phase 8 scope

- `src/3d/editor/editorFaces.js`
  - création de face draft depuis une boucle d’arêtes sélectionnées
  - validation boucle fermée
  - validation coplanarité
  - refus des auto-intersections

## Current behavior

- `F` en mode avancé avec une boucle valide crée une face draft
- les faces sont affichées en transparence dans le viewport
- la suppression d’une ligne invalide supprime aussi les faces draft dépendantes

## Non-goal

- aucune sérialisation catalogue des faces draft dans cette phase.
