"""Assemble the shareable client-side app (index.html).

Source lives in src/app/ split by feature:
  template.html  -- document shell with /*CSS*/, <!--BODY-->, /*JS*/ slots
  styles.css     -- all styles
  body.html      -- page markup (tabs + panes)
  js/*.js        -- one module per feature, concatenated in JS_ORDER

The output stays a single offline-capable index.html; default range tables
from ranges.py are injected at build time.

Usage: python src/build_app.py [-o index.html]
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dashboard import build_range_tables

APP_DIR = Path(__file__).parent / "app"

JS_ORDER = [
    "constants",     # ranks / spot keys / 169-grid classes
    "storage",       # localStorage load/save helpers
    "zip",           # client-side zip reader
    "parser",        # GG hand-history parser
    "preflop",       # preflop spot detection + range judging
    "stats",         # HUD stat flags + stored record shape
    "import",        # upload / dedup / upgrade flow
    "goal",          # stake goal widget
    "range_editor",  # editable range tables
    "notes",         # per-hand notes
    "diary",         # session diary
    "backup",        # full export / import
    "render",        # all dashboard rendering
    "tabs",          # tab navigation + boot
]


def weighted_defaults() -> dict:
    """Convert pure-strategy tables to weight form {r, c, f} (percent)."""
    out = {}
    for key, table in build_range_tables().items():
        wt = {}
        for hand, act in table.items():
            if key == "RFI SB" and act == "raise":
                wt[hand] = {"r": 75, "c": 25, "f": 0}   # raise or limp both fine
            elif key == "RFI SB" and act == "limp":
                wt[hand] = {"r": 25, "c": 75, "f": 0}
            elif act in ("raise", "3bet", "4bet"):
                wt[hand] = {"r": 100, "c": 0, "f": 0}
            elif act in ("call", "limp"):
                wt[hand] = {"r": 0, "c": 100, "f": 0}
            else:
                wt[hand] = {"r": 0, "c": 0, "f": 100}
        out[key] = wt
    return out


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def assemble() -> tuple[str, dict]:
    shell = read(APP_DIR / "template.html")
    css = read(APP_DIR / "styles.css").rstrip("\n")
    body = read(APP_DIR / "body.html").rstrip("\n")
    js = "\n\n".join(
        read(APP_DIR / "js" / f"{name}.js").rstrip("\n") for name in JS_ORDER
    )
    html = (
        shell.replace("/*CSS*/", css)
             .replace("<!--BODY-->", body)
             .replace("/*JS*/", js)
    )
    tables = weighted_defaults()
    return html.replace("/*TABLES*/", json.dumps(tables, ensure_ascii=False)), tables


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--output", default="index.html")
    args = ap.parse_args()
    html, tables = assemble()
    Path(args.output).write_text(html, encoding="utf-8", newline="\n")
    print(f"app written to {args.output} "
          f"({len(JS_ORDER)} js modules, {len(tables)} default tables embedded)")


if __name__ == "__main__":
    main()
