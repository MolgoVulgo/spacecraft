# Editor shape compiler

Phase 10 compiles Editor output into a catalog-compatible `shape_variant`.

Current policy:

- the in-memory Editor state stays editable;
- `saveDraft`, `exportCatalog` and `publishCatalogToAssembly` compile a cloned catalog output;
- Assembly is not modified.

Compilation rules:

1. refuse export if a shape still has advanced draft edges or faces;
2. preserve catalog identity fields:
   - `shape_variant.id`
   - `variant_index`
   - linked `catalog_pieces`
   - `spec_profiles`
   - `recipes`
3. keep `generation.operations[]` as the advanced source of truth;
4. regenerate `preview_mesh` from the current generated geometry;
5. preserve `collision`, defaulting to `base_box` when absent.

Result:

- published JSON stays readable by Assembly;
- advanced operations remain available through `generation.operations[]`;
- the exported catalog now carries a refreshed `preview_mesh`.
