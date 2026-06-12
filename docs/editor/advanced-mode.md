# Editor geometry editing

The Editor now exposes one geometry editing panel for editable variants.

Workflow:

1. select an editable variant
2. optionally switch display to `Points`
3. select bbox edges for `Chanfrein` / `Arrondi`
4. select points
5. create draft edges
6. create a draft face
7. convert the draft face into:
   - `Face`
   - `Coupe`
8. compile through draft/export/publish

Current geometry operations:

- `Chanfrein`: adds one `edge_chamfer` operation for the selected stable edge ids
- `Arrondi`: adds one `edge_fillet` operation for the selected stable edge ids
- `Face`: adds a planar visible polygon
- `Coupe`: clips the solid with the face plane and keeps one side

Current limits:

- stable edge selection starts with bbox top/bottom perimeter edges
- no decorative modeling
- no free-form boolean modeling beyond simple planar cut
- collision stays simplified (`base_box`)
- compilation publishes `generation.operations[]` plus a regenerated `preview_mesh`
