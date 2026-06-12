# Assembly Engine Isolation

## Phase 2 scope

- `src/3d/assembly/selection.js`
  - normalisation et batch de sélection Assembly
  - multisélection de pièces libres
- `src/3d/assembly/groups.js`
  - connectivité d’un futur groupe
  - validation métier avant création de groupe
- `src/3d/assembly/variants.js`
  - calcul palette de variantes Assembly
  - application d’une variante à une instance existante

## Current split

- `src/main.js`
  - orchestre l’UI Assembly, la scène, le rendu et les callbacks
  - conserve encore le drag/snap/collision détaillé
- `src/3d/assembly/*`
  - porte la logique métier Assembly isolable et testable sans DOM

## Intentional limitation

- le moteur de drag/snap n’est pas encore extrait complètement dans cette phase pour éviter une régression de mouvement.
