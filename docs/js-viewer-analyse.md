# Analyse de la partie JavaScript

Ce document décrit le fonctionnement actuel du viewer web situé à la racine du dépôt.
Il s'appuie sur le code réel, principalement `src/main.js`, `src/style.css`, `index.html` et `public/data/4x3x1_catalog.json`.

## Vue d'ensemble

La partie JavaScript est un viewer / assembleur 3D basé sur Vite et Three.js.

Elle repose sur une architecture très directe :

- `index.html` définit tout le shell UI ;
- `src/main.js` contient l'état, le rendu Three.js, les interactions, la collision et le pilotage DOM ;
- `src/style.css` gère l'interface latérale et le viewport ;
- `public/data/4x3x1_catalog.json` contient le catalogue de pièces et les meshes.

Il n'y a pas de framework UI, pas de backend, pas de persistance de scène, et pas de séparation forte en modules applicatifs.

## Modèle de données

### Catalogue

Le catalogue est chargé depuis :

`/data/4x3x1_catalog.json`

La structure contient :

- un bloc `catalog` avec les métadonnées globales ;
- un tableau `pieces`.

Chaque pièce contient notamment :

- `id`
- `displayName`
- `logicalSize`
- `unitScale`
- `sourceFile`
- `bounds`
- `stats`
- `mesh`
- parfois `centeredMesh`
- des métadonnées de variantes de miroir.

Le viewer ne génère pas ses propres pièces. Il consomme les données du catalogue comme source de vérité.

### Instances de scène

Les objets manipulés par l'utilisateur sont stockés dans `state.instances`.

Chaque instance contient en pratique :

- `id`
- `label`
- `pieceId`
- `mirrorState`
- `group`
- `mesh`
- `edges`
- `material`
- `edgeMaterial`

La position réelle est portée par `group.position`.

Les symétries sont stockées dans `mirrorState` avec trois booléens indépendants :

- `x` pour la longueur ;
- `y` pour la largeur ;
- `z` pour la hauteur.

## État global

L'application centralise son état dans un seul objet `state` :

- `catalog`
- `instances`
- `selectedId`
- `nextInstanceId`
- `drag`
- `lastMessage`

Ce choix garde le code simple, mais concentre beaucoup de responsabilités dans `src/main.js`.

## Initialisation

Au chargement :

1. le renderer Three.js est créé ;
2. la scène, la caméra, la grille, les lumières et les contrôles orbitaux sont configurés ;
3. `init()` charge le catalogue JSON via `fetch` ;
4. la liste des pièces ajoutables est remplie ;
5. les événements DOM et viewport sont branchés ;
6. la boucle `animate()` démarre.

La scène démarre vide. Aucune pièce n'est créée automatiquement.

## Interface utilisateur

L'UI est définie directement dans `index.html`.

Le panneau gauche expose :

- la sélection de pièce de catalogue ;
- l'ajout d'une pièce ;
- la liste des instances présentes ;
- la duplication, suppression, vidage de scène, désélection ;
- la couleur de la sélection ;
- les trois symétries indépendantes ;
- le reset de symétries ;
- la gestion de hauteur ;
- la grille et l'accrochage ;
- les actions de vue ;
- un bloc de statistiques.

Le viewport principal contient :

- le canvas WebGL ;
- un message centré quand la scène est vide ;
- une aide d'utilisation en surimpression.

## Rendu 3D

Le rendu repose sur :

- `THREE.WebGLRenderer`
- `THREE.Scene`
- `THREE.PerspectiveCamera`
- `OrbitControls`

Le fond est sombre et la scène utilise :

- une `GridHelper` ;
- une lumière hémisphérique ;
- deux lumières directionnelles.

Chaque instance est un `THREE.Group` contenant :

- un `MeshStandardMaterial` avec un `Mesh` principal ;
- des arêtes reconstruites via `EdgesGeometry`.

Une `BoxHelper` sert de surbrillance pour la sélection.

## Géométrie et symétries

La construction de géométrie passe par `buildGeometry(piece, mirrorState)`.

Le flux est le suivant :

1. choisir `piece.centeredMesh` si disponible, sinon `piece.mesh` ;
2. appliquer les miroirs en inversant les coordonnées de sommets ;
3. compter le nombre d'axes inversés ;
4. si ce nombre est impair, inverser l'ordre des triangles ;
5. recalculer normales, bounding box et bounding sphere.

Ce point est important :

- une symétrie ne modifie pas le catalogue ;
- elle reconstruit une géométrie propre à l'instance ;
- les trois axes sont indépendants ;
- le reset de symétries remet seulement ces trois booléens à `false`.

## Ajout et duplication

L'ajout d'une pièce crée une nouvelle instance avec :

- un identifiant incrémental `piece-N` ;
- une géométrie construite pour cette instance ;
- une couleur initiale ;
- une position libre calculée automatiquement.

La recherche d'emplacement utilise `findAvailablePosition()` :

- calcul à partir de la bounding box de la géométrie ;
- exploration de positions par anneaux autour de l'origine ;
- plusieurs niveaux de hauteur testés ;
- refus de toute position en collision.

La duplication réutilise :

- la même pièce source ;
- la même couleur ;
- le même état de symétrie ;
- un ensemble d'offsets candidats autour de l'instance d'origine.

## Sélection et manipulation

La sélection peut se faire de deux manières :

- via la liste `Pièces dans la scène` ;
- par clic direct sur un mesh dans la vue 3D.

Le déplacement horizontal passe par drag souris :

- raycast sur la pièce ;
- création d'un plan de drag à la hauteur actuelle ;
- désactivation temporaire d'`OrbitControls` ;
- déplacement contraint au plan horizontal ;
- application optionnelle du snap de grille.

Le déplacement vertical se fait via :

- les boutons `Monter` / `Descendre` ;
- la saisie directe dans `Hauteur sélection` ;
- `PageUp` / `PageDown`.

## Collision

La collision est basée sur les bounding boxes des géométries d'instance.

Le test `boxesOverlap(a, b)` utilise des comparaisons strictes avec un petit epsilon :

```js
a.min.x < b.max.x - COLLISION_EPSILON
```

Conséquences :

- le contact exact reste autorisé ;
- le chevauchement volumique est refusé ;
- la collision repose sur la boîte englobante du mesh courant, pas sur une enveloppe logique fixe indépendante du mesh.

C'est un point important par rapport aux règles métier visées : le code actuel est simple et stable, mais il ne force pas explicitement une collision purement basée sur `logicalSize`.

## Grille et accrochage

La grille est un `GridHelper` affiché dans la scène.

Deux comportements existent :

- affichage on/off ;
- accrochage optionnel lors du drag.

Quand le snap est actif :

- `x` et `y` sont arrondis au pas choisi ;
- la hauteur `z` n'est pas affectée par ce snap horizontal.

## Vue et caméra

La caméra dispose de plusieurs actions :

- `Vue reset`
- `Zoom sélection`
- `Zoom scène`
- navigation OrbitControls

`fitCameraToObject()` cadre soit une instance, soit le groupe racine de la scène entière.

## Statistiques et feedback

Le panneau stats affiche :

- nombre de pièces dans la scène ;
- sélection courante ;
- identifiant et source de la pièce ;
- symétries ;
- taille logique ;
- taille mesh ;
- triangles, sommets, fermeture du mesh ;
- position ;
- message d'état éventuel.

Les messages fonctionnels passent par `setMessage()`, par exemple :

- collision lors d'un déplacement ;
- collision lors d'une symétrie ;
- ajout impossible.

## Raccourcis clavier actuels

Les raccourcis réellement implémentés sont :

- `A` : ajouter la pièce de catalogue sélectionnée
- `F` : cadrer la sélection, sinon cadrer toute la scène
- `R` : reset de vue
- `PageUp` : monter la pièce sélectionnée
- `PageDown` : descendre la pièce sélectionnée
- `Escape` : désélectionner
- `Delete` ou `Backspace` : supprimer la pièce sélectionnée

Ils sont désactivés quand le focus est dans un `input` ou un `select`.

## Limitations actuelles

### Limites fonctionnelles

- Il n'y a pas de persistance de scène.
- Il n'y a pas d'export de composition.
- Il n'y a pas de rotation libre ni d'orientation pilotée.
- Il n'y a pas de système d'ancrage logique pour le placement.
- Le déplacement souris ne gère que le plan horizontal.
- Il n'y a pas d'historique, undo/redo ou verrouillage d'instance.
- Il n'y a pas de renommage manuel d'instance.
- Il n'y a pas de filtrage ou recherche dans la liste de pièces.

### Limites techniques

- Toute la logique applicative est concentrée dans `src/main.js`, ce qui rend l'évolution plus coûteuse.
- Le viewer dépend d'un chargement `fetch` direct du catalogue ; si le fichier est absent ou invalide, l'application tombe en erreur au démarrage.
- La collision repose sur les bounding boxes géométriques des meshes chargés, pas sur une enveloppe logique imposée par `logicalSize`.
- La recherche d'emplacement libre est heuristique ; elle est simple, mais pas garantie optimale ni exhaustive pour de très grandes scènes.
- Le reset de symétries reconstruit la géométrie, donc chaque variation passe par remplacement d'objets Three.js.

### Limites produit

- Le viewer est un assembleur guidé, pas un éditeur 3D générique.
- Le catalogue est supposé déjà préparé ; il n'existe pas de pipeline d'import utilisateur dans l'application.
- La scène n'est pas destinée à servir de format métier durable.

## Écart entre intention et état réel

Par rapport aux règles métier générales du dépôt, l'état actuel du JS montre quelques écarts ou simplifications :

- la collision semble fondée sur la géométrie englobante du mesh, pas strictement sur une enveloppe logique constante `4x3x1` ;
- les coordonnées utilisateur affichées sont celles de la scène Three.js, pas un modèle logique séparé durable ;
- l'instance stocke des références Three.js directement, pas un objet métier pur sérialisable ;
- le système de symétrie est correct au niveau instance, mais il n'existe pas encore d'abstraction métier séparée du rendu.

## Conclusion

La partie JavaScript actuelle est un viewer d'assemblage cohérent et déjà utilisable :

- scène vide au démarrage ;
- ajout manuel depuis un catalogue ;
- instances indépendantes ;
- sélection par liste ou clic ;
- drag horizontal ;
- hauteur indépendante ;
- couleur par instance ;
- trois symétries indépendantes ;
- collision stricte et prévisible ;
- actions de vue utiles.

Sa principale limite actuelle est la centralisation du code dans un seul fichier et l'usage de bounding boxes de mesh comme base de collision, là où le modèle métier cible évoque plutôt une enveloppe logique indépendante du détail géométrique.
