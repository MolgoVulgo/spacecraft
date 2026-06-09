# UI Refactor Report

## Summary

The Python editor now runs through a native Qt shell with a central embedded Ursina/Panda3D viewport, native side panels, and a native menu bar.

## Files changed

- `main.py`
- `piece_editor/app_shell.py`
- `piece_editor/core.py`
- `piece_editor/qt_theme.py`
- `piece_editor/runtime.py`
- `piece_editor/theme.py`
- `piece_editor/ui_panels.py`
- `piece_editor/ursina_theme.py`
- `piece_editor/viewport_widget.py`
- `piece_editor/viewer.py`
- `README.md`

## Removed Ursina overlay UI

- Removed runtime use of `UISelect`, `EditorMenu`, and `TopMenuBar`
- Deleted `piece_editor/ui.py`
- Removed status/help overlay text from the runtime path

## Native UI structure

- `QMainWindow`
- Native menu bar
- Native left controls dock
- Native right inspector dock
- Native status bar
- Central embedded viewport widget

## 3D viewport integration method

The viewport is opened by Ursina/Panda3D as a child window of a native Qt host widget created inside the central area. Qt-level fallbacks are used for keyboard shortcuts and part of the mouse interaction path.

## Preserved behaviors

- Edit mode piece display
- Assembly mode instance display
- Grid toggle
- Anchor visibility toggle
- Height movement
- Collision checks
- Save/export actions
- Dynamic shape parameter refresh

## Known limitations

- Embedded Panda3D on Wayland requires forcing Qt to `xcb`
- Native embedded mouse behavior is partially compensated by Qt event fallbacks
- Camera orbit by mouse depends on the Qt fallback path, not only Ursina's `EditorCamera`

## Deviations from plan

- The viewport integration required backend-specific workarounds for Wayland/X11 compatibility.
- Some viewport input is routed through Qt shortcuts and Qt mouse events instead of relying purely on Ursina input dispatch.

## Verification performed

- `python -m py_compile main.py piece_editor/*.py`
- `pytest tests/test_core.py tests/test_models.py tests/test_storage.py tests/test_shape_builder.py tests/test_catalog_export.py tests/test_interaction.py`
- Manual checks reported during iteration for embedded window launch, zoom, keyboard shortcuts, and basic viewport interaction
