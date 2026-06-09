# Assembly orthographic axis and placement correction

Assembly now uses an orthographic control camera by default.

Coordinate convention is fixed:

```txt
X = width
Y = depth / length
Z = height
```

The default view is `Vue dessus`, where X/Y can be checked without perspective distortion.

New view buttons:

```txt
Vue dessus : X width / Y depth-length
Vue face   : X width / Z height
Vue côté   : Y depth-length / Z height
```

Double-clicking a size adds the new part behind the selected or last part on Y, not side-by-side on X.

A temporary overlay displays the active view and the selected part dimensions.
