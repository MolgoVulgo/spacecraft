# Necessary Context / Decisions Not To Lose

## User-level decisions

- Assembly is for users.
- Editor is internal only.
- Do not expose editing features in Assembly.
- The most important remaining task is functional assembly movement.
- The user will continue through Codex from a stable code base.

## Catalog creation model

Pieces are fixed by the game catalog. Do not allow arbitrary free-size pieces.

Allowed base families/sizes include:

```text
ACIER
- Acier 4x3x1
- Acier 6x3x1
- Acier 8x3x1
- Acier 4x3x2
- Acier 6x3x2
- Acier 8x3x2
- Acier 8x6x2

TITANE SUPÉRIEUR
- Titane 4x3x1
- Titane 6x3x1
- Titane 8x3x1
- Titane 4x3x2
- Titane 6x3x2
- Titane 8x3x2
- Titane 8x6x2
- Titane 12x6x2
- Titane 16x6x2

CHÂSSIS AVANCÉS
- Châssis solide 4x3x1
- Châssis solide 6x3x1
- Châssis solide 8x3x1
- Châssis solide 8x6x2
- Châssis solide 12x6x2
- Châssis solide 16x6x2

ALLIAGES ULTRA LÉGERS
- Lévinium 4x3x2
- Lévinium 6x3x2
- Lévinium 8x3x2
```

## Functional geometry rules

Ignore decoration.

Preserve:

```text
real fixed dimensions
main silhouette
slopes
structural rounded forms
chamfers
anchors
collision/reservation
symmetry behavior
```

## Anchors

- Anchors are on exposed faces.
- They are visualized as red dots.
- Assembly hides them by default.
- Editor uses them for placement/editing.
- On a `4x3x1` side of length 4, there should be 8 possible anchor positions at 0.5 step.

## Assembly drag principle

Pieces should feel magnetic by anchors.

Priority:

```text
1. grid snap 0.5
2. side-anchor snap
3. auto-Z fallback
4. invalid red if not connected
5. hard block or rollback for impossible final collision
```

This is an interaction model, not merely a collision model.
