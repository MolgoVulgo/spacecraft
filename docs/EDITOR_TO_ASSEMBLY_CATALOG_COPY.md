# Editor to Assembly Catalog File

The application must not use `localStorage` to pass catalog data from the editor to assembly.

Assembly reads a single reference file:

```txt
/data/4x3x1_catalog.json
```

In the source tree this file is:

```txt
public/data/4x3x1_catalog.json
```

## Editor publish flow

```txt
editor.html
→ Publier vers Assembly
→ PUT /api/catalog/write
→ writes public/data/4x3x1_catalog.json
→ reload index.html
→ assembly reads /data/4x3x1_catalog.json
```

The write endpoint exists only in the Vite dev server. In a static build, browser code cannot write project files, so the editor downloads the catalog JSON and the file must be replaced manually.

## Assembly load flow

```txt
index.html
→ fetch('/data/4x3x1_catalog.json', { cache: 'no-store' })
→ no localStorage fallback
→ fail clearly if the file is missing
```

## Reason

Using a browser cache as the assembly source creates false positives during tests: assembly can keep displaying old forms even if the JSON file was removed. A single file source keeps editor and assembly deterministic.
