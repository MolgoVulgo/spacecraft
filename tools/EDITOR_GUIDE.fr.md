# Guide de l'éditeur Python

## Rôle

L'éditeur Python dans `tools/` est l'outil source pour créer les pièces.

Il sert à :

- définir la taille logique d'une pièce ;
- choisir un matériau et un format de base autorisé ;
- choisir une variante de forme ;
- éditer un volume voxel manuel dans l'enveloppe logique fixe ;
- éditer les cellules d'ancrage ;
- prévisualiser la pièce en 3D ;
- ajouter des instances dans une scène d'assemblage ;
- sauvegarder les données JSON durables de la pièce.

Le viewer web n'est pas l'outil d'édition de forme.

## Lancement

Depuis `tools/` :

```bash
python -m pip install -r requirements.txt
python ./main.py
```

## Système de coordonnées

Coordonnées logiques de la pièce :

- `x` = longueur
- `y` = largeur
- `z` = hauteur

Correspondance dans la scène Ursina :

- scène `X` = longueur logique
- scène `Z` = largeur logique
- scène `Y` = hauteur logique

## Règles principales

- La taille logique est la référence.
- Une pièce ne peut pas être plus petite que le format de base sélectionné.
- Les cellules internes `1x1x1` sont des cellules d'édition, pas la vraie taille de la pièce.
- La collision utilise toujours l'enveloppe logique complète.
- Le contact face à face, arête à arête et coin à coin est autorisé.
- Le chevauchement avec volume positif est bloqué.

## Modes

### Mode édition

Le mode édition sert à travailler sur une seule définition de pièce.

Ce que tu peux faire :

- choisir le matériau ;
- choisir le format de base ;
- choisir la variante ;
- basculer entre rendu de variante et édition voxel ;
- modifier les paramètres de forme de la variante ;
- remplir ou vider le volume éditable ;
- activer ou désactiver des cellules solides ;
- activer ou désactiver des cellules d'ancrage ;
- sauvegarder la pièce courante.

### Mode assemblage

Le mode assemblage sert à placer plusieurs instances dans une même scène.

Ce que tu peux faire :

- ajouter une instance depuis la pièce courante ;
- sélectionner des instances ;
- déplacer l'instance sélectionnée ;
- déplacer une instance avec la souris ;
- supprimer l'instance sélectionnée ;
- vérifier visuellement les collisions.

## Menu

Le menu de gauche est divisé en sections.

### Mode

- `Edit`
  Passe en mode édition.
- `Assembly`
  Passe en mode assemblage.

### Catalogue

- `Material`
  Sélectionne la famille de matériau : `acier` ou `titane`.
- `Base size`
  Sélectionne une des tailles logiques autorisées pour le matériau courant.
- `Variant`
  Sélectionne le sous-type de forme courant.

### Forme

- `Variant shape`
  Affiche et édite la forme paramétrique de la variante.
- `Voxel shape`
  Affiche et édite la pièce comme un volume manuel `1x1x1`.
- `Shape ...`
  Champs dynamiques visibles seulement si la variante sélectionnée a des paramètres.

Exemples de paramètres dynamiques :

- axe de pente ;
- profil de pente ;
- début / fin ;
- bas / haut ;
- côté arrondi ;
- rayon ;
- côté du chanfrein ;
- nombre de chanfreins ;
- valeur du chanfrein.

### Édition

- `Reset variant`
  Restaure la forme paramétrique par défaut de la variante courante.
- `Fill volume`
  Remplit le volume voxel éditable dans toute l'enveloppe logique.
- `Clear volume`
  Réinitialise le volume voxel à une seule cellule minimale.
- `Prev piece`
  Charge la pièce précédente du catalogue.
- `Next piece`
  Charge la pièce suivante du catalogue.
- `New piece`
  Crée une nouvelle pièce personnalisée à partir du format de base par défaut.
- `Save piece`
  Sauvegarde la pièce courante en JSON.
- `Toggle solid`
  Active ou désactive la cellule solide sous le curseur d'édition.
- `Toggle anchor`
  Active ou désactive la cellule d'ancrage sous le curseur d'édition.

### Assemblage

- `Add instance`
  Ajoute une instance d'assemblage à partir de la pièce courante.
- `Center scene`
  Recentre la caméra.
- `Delete selected`
  Supprime l'instance sélectionnée.

## Raccourcis clavier

### Globaux

- `F1`
  Passe en mode édition.
- `F2`
  Passe en mode assemblage.
- `C`
  Centre la scène.
- `Ctrl+S`
  Sauvegarde la pièce courante.
- `Molette vers le haut`
  Zoom avant.
- `Molette vers le bas`
  Zoom arrière.

### Mode édition

- `A`
  Déplace le curseur d'édition de `-1` sur la longueur.
- `D`
  Déplace le curseur d'édition de `+1` sur la longueur.
- `W`
  Déplace le curseur d'édition de `+1` sur la largeur.
- `S`
  Déplace le curseur d'édition de `-1` sur la largeur.
- `Q`
  Déplace le curseur d'édition de `-1` sur la hauteur.
- `E`
  Déplace le curseur d'édition de `+1` sur la hauteur.
- `Space`
  Active ou désactive la cellule solide sous le curseur.
- `R`
  Active ou désactive la cellule d'ancrage sous le curseur.
- `1`
  Matériau précédent.
- `2`
  Matériau suivant.
- `3`
  Format de base précédent.
- `4`
  Format de base suivant.

### Mode assemblage

- `Tab`
  Sélectionne l'instance suivante.
- `A`
  Déplace l'instance sélectionnée de `-1` sur la longueur.
- `D`
  Déplace l'instance sélectionnée de `+1` sur la longueur.
- `W`
  Déplace l'instance sélectionnée de `+1` sur la largeur.
- `S`
  Déplace l'instance sélectionnée de `-1` sur la largeur.
- `Q`
  Déplace l'instance sélectionnée de `-1` sur la hauteur.
- `E`
  Déplace l'instance sélectionnée de `+1` sur la hauteur.
- `Delete`
  Supprime l'instance sélectionnée.

## Contrôles souris

### Mode édition

- Molette de la souris
  Zoom de la caméra.

### Mode assemblage

- Clic gauche sur une pièce
  Sélectionne l'instance survolée.
- Clic gauche + glisser
  Déplace l'instance sélectionnée sur le plan horizontal.
- Molette de la souris
  Zoom de la caméra.

## Aides visuelles

- `V`
  Affiche ou masque les cellules d'ancrage.
- `B`
  Affiche ou masque le contour de l'enveloppe logique.

## Sauvegarde

`Save piece` écrit dans :

- `tools/data/pieces.json`
  Catalogue principal mis à jour par identifiant de pièce.
- `tools/data/user_piece.json`
  Snapshot de la pièce courante uniquement.

## Flux d'édition courant

Exemple de flux typique pour une nouvelle pièce :

1. Choisir `Material`.
2. Choisir `Base size`.
3. Choisir `Variant`.
4. Ajuster les paramètres `Shape` si nécessaire.
5. Passer en `Voxel shape` si une édition manuelle est nécessaire.
6. Déplacer le curseur avec `A/D/W/S/Q/E`.
7. Utiliser `Space` pour activer ou désactiver les cellules solides.
8. Utiliser `R` pour activer ou désactiver les cellules d'ancrage.
9. Sauvegarder avec `Save piece` ou `Ctrl+S`.

## Notes

- `Variant shape` sert à l'édition paramétrique de la pièce.
- `Voxel shape` sert à l'édition manuelle du volume `1x1x1`.
- L'édition des cellules solides fait basculer la logique de la pièce vers le workflow voxel.
- Les instances ajoutées en assemblage utilisent la définition courante de la pièce, mais restent indépendantes une fois placées.
