# Editor Interaction Controller

## Mapping souris

- `clic gauche` sur primitive: sélection / remplacement
- `Shift + clic gauche` sur primitive: toggle explicite
- `drag gauche` sur vide: pan viewport
- `clic droit` court: menu contextuel géométrique
- `drag droit` sur vide: orbit ou pan selon `spacecraft.user_settings.v1`

## Règles

- pas de sélection rectangle dans l'Editor
- `OrbitControls` ne possède plus le bouton gauche
- le canvas désactive toujours le menu contextuel natif
- le menu contextuel filtre les actions selon la sélection persistante, puis le hover

## Modèle de sélection

- `point`
- `line`
- `edge`
- `face`

L'état interne garde des ensembles par type plus une primitive active. L'implémentation actuelle branche les workflows existants sur `face`, `editable edge`, `advanced point` et `advanced line`.

## Régression visuelle à vérifier

- clic face: résumé face + ancres toujours synchronisés
- drag gauche sur vide: la caméra bouge, jamais la géométrie
- drag droit: pas d'ouverture de menu
- clic droit court: uniquement les actions compatibles
