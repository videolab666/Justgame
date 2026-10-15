"""Validate local original vector sprites before publishing to the government site."""
from pathlib import Path
import xml.etree.ElementTree as ET
import sys

ROOT = Path(__file__).resolve().parents[1]
paths = sorted((ROOT / "assets").rglob("*.svg"))
errors = []
if len(paths) < 53:
    errors.append(f"Expected 53 game vector files, got {len(paths)}")
for path in paths:
    try:
        tree = ET.parse(path)
        root = tree.getroot()
        if root.tag != "{http://www.w3.org/2000/svg}svg":
            errors.append(f"{path}: not an SVG root")
        if "viewBox" not in root.attrib:
            errors.append(f"{path}: viewBox missing")
        for el in tree.iter():
            for key, value in el.attrib.items():
                if key.lower().endswith("href") and (value.startswith("http:") or value.startswith("https:")):
                    errors.append(f"{path}: remote dependency {value}")
    except ET.ParseError as exc:
        errors.append(f"{path}: invalid SVG XML: {exc}")
if errors:
    print("\n".join(errors),file=sys.stderr)
    raise SystemExit(1)
print(f"Validated {len(paths)} local SVG illustrations")
