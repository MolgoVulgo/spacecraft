# Assembly size/shape flow

Assembly now separates placement and form selection.

## Placement

A placed piece is created from the size list, not from the shape palette.

Flow:

```txt
Famille / matériau
-> Taille
-> double-click or drag-drop size into scene
-> base catalog piece is added
```

The default placement uses the best standard/base catalog entry for the selected family and size.

## Shape change

The shape palette does not add pieces anymore.

Flow:

```txt
select placed piece in scene
-> click a shape icon
-> selected placed piece switches to that shape variant
```

The shape change is refused if the selected placed piece does not match the same family and size.

## Assembly rendering

Assembly uses solid rendering. The 1x1x1 voxel grid is editor-only.

Legacy preview meshes are not used directly in Assembly anymore because they can contain old Python/STL scale and orientation data. Assembly rebuilds simplified normalized geometry from catalog dimensions.

Coordinate convention in Assembly:

```txt
world X = width
world Y = depth / length
world Z = height
```

Every placed piece is therefore oriented in the same depth direction.
