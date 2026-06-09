# Assembly / Editor Split

## Goal

Separate the public assembly planner from the internal catalog editor.

The two surfaces share the same rich catalog, repository/resolver layer and Three.js viewport, but they do not expose the same actions.

## Public assembly

Entry point:

```text
index.html
```

Allowed actions:

```text
select catalog_piece
add placed_piece
move / duplicate / delete placed_piece
apply instance symmetry
change instance color
export ship blueprint
screenshot
```

Forbidden actions:

```text
create shape_variant
edit shape_variant
edit anchors
create catalog_piece
edit spec_profile
edit recipe
export catalog
```

## Internal editor

Entry point:

```text
editor.html
```

Allowed additional actions:

```text
create / duplicate shape_variant
create catalog_piece
edit shape metadata
edit anchors JSON
edit spec profiles
edit recipes
export rich catalog
```

## Distribution rule

For a user-facing distribution, build with:

```bash
npm run build:assembly
```

This removes `editor.html` from `dist/` after the Vite build.

## Runtime guard

`src/main.js` detects the surface from:

```text
<body data-app-mode="assembly">
<body data-app-mode="editor">
```

Editor controls are only bound when `APP_MODE === "editor"`.
