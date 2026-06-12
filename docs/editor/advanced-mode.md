# Editor advanced mode

Advanced mode is for shape authoring with sub-grid points.

Workflow:

1. switch to `Avancé`
2. optionally switch display to `Points`
3. select points
4. create edges
5. create a draft face
6. convert the draft face into:
   - `Face`
   - `Coupe`
7. compile through draft/export/publish

Current advanced operations:

- `Face`: adds a planar visible polygon
- `Coupe`: clips the solid with the face plane and keeps one side

Current limits:

- no decorative modeling
- no free-form boolean modeling beyond simple planar cut
- collision stays simplified (`base_box`)
- compilation publishes `generation.operations[]` plus a regenerated `preview_mesh`
