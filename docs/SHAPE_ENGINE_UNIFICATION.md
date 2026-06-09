# Shape engine unification

## Goal

Assembly and editor now use `src/shape-engine.js` as the single geometry source.

## Axis convention

The shape engine emits final world coordinates directly:

```txt
X = catalog width
Y = catalog length / depth
Z = catalog height
```

No post-generation axis swap is applied in Assembly.

## Display modes

`buildShapeGeometry()` accepts `showVoxels`:

```js
buildShapeGeometry({ shape, size, scale, symmetry, showVoxels: true })
buildShapeGeometry({ shape, size, scale, symmetry, showVoxels: false })
```

- `showVoxels: true`: editor display, voxel cells remain visible.
- `showVoxels: false`: assembly display, solid catalogue piece.

## Removed from Assembly

`src/main.js` no longer contains shape mesh generators:

```txt
buildGeometryFromIndexedMesh
buildPrimitiveGeometry
buildParametricGeometry
getParametricFootprint
getParametricPrismMesh
getBoxMesh
getWedgeMesh
buildFallbackBoxGeometry
```

Assembly now delegates form generation to `shape-engine`.

## Bounds / collision

Selection and collision reservation boxes use the same convention through:

```js
createCatalogReservationBox(size, scale, position)
```

The fixed catalogue dimensions remain authoritative even when the visible shape is partially empty.
