from __future__ import annotations

import os

if not os.environ.get("QT_QPA_PLATFORM") and os.environ.get("XDG_SESSION_TYPE") == "wayland" and os.environ.get("DISPLAY"):
    os.environ["QT_QPA_PLATFORM"] = "xcb"

try:
    from piece_editor.app_shell import run_native_shell
except ModuleNotFoundError as exc:
    if exc.name == "PySide6":
        raise SystemExit("PySide6 is required. Install tools/requirements.txt in the Python environment used to run tools/main.py.") from exc
    raise


if __name__ == "__main__":
    raise SystemExit(run_native_shell())
