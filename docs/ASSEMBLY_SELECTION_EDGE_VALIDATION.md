# Assembly selection, edges, and attachment validation

## Selection hitbox

The selected piece reservation box is no longer yellow. It uses a theme-level constant in `src/main.js`:

```js
THEME_COLORS.selectionHitbox
```

Current value: blue.

## Assembly edge rendering

Assembly removes editor/voxel seams from visible edges.

Before edge extraction, the geometry is cloned and passed through `mergeVertices()`; then `EdgesGeometry` is created with a hard-edge threshold. This keeps external/hard contours and removes coplanar internal cell boundaries introduced by voxel-derived operations.

Editor remains unchanged: it still shows 1x1x1 voxel boundaries for shape editing.

## Attachment error display

Attachment validation now uses a root-connected graph:

- the first placed piece is the root/reference piece;
- pieces connected to the root through compatible anchor pairs are valid;
- only disconnected pieces are outlined red;
- valid pieces keep black outlines.

This prevents every piece from turning red when a newly placed piece fails to attach.
