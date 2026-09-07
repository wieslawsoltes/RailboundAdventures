#!/usr/bin/env python3
"""Build and validate a project-subdirectory-safe GitHub Pages artifact."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_site"


def main():
    subprocess.run([sys.executable, str(ROOT / "tools/build.py")], check=True)
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for name in ("src", "styles", "assets"):
        shutil.copytree(ROOT / name, OUT / name)
    for name in ("index.html", "manifest.webmanifest", "sw.js", "LICENSE"):
        shutil.copy2(ROOT / name, OUT / name)
    (OUT / ".nojekyll").touch()
    (OUT / "downloads").mkdir()
    shutil.copy2(ROOT / "dist/index.html", OUT / "downloads/Railbound-Adventures.html")

    # Content-address the cache. Rebuilding identical source preserves its key.
    digest = hashlib.sha256()
    for file in sorted(OUT.rglob("*")):
        if file.is_file():
            digest.update(file.relative_to(OUT).as_posix().encode())
            digest.update(b"\0")
            digest.update(file.read_bytes())
    version = digest.hexdigest()[:16]
    sw = (OUT / "sw.js").read_text()
    sw, count = re.subn(r"const CACHE = '[^']+';", f"const CACHE = 'railbound-adventures-{version}';", sw, count=1)
    if count != 1:
        raise RuntimeError("Could not stamp service-worker cache version")
    (OUT / "sw.js").write_text(sw)
    (OUT / "version.json").write_text(json.dumps({
        "application": "Railbound Adventures", "version": version,
        "commit": os.environ.get("GITHUB_SHA", "local"),
    }, indent=2) + "\n")

    def require_asset(value, parent=OUT):
        if not value or value.startswith(("#", "data:", "https:", "http:")):
            return
        if value.startswith("/"):
            raise ValueError(f"Root-relative asset is not project-safe: {value}")
        target = (parent / value.split("?", 1)[0].split("#", 1)[0]).resolve()
        if not target.is_relative_to(OUT.resolve()) or not target.exists():
            raise FileNotFoundError(f"Missing or escaping asset: {value}")

    class Assets(HTMLParser):
        def handle_starttag(self, tag, attrs):
            attrs = dict(attrs)
            if tag in ("link", "script", "img"):
                require_asset(attrs.get("src") or attrs.get("href"))

    Assets().feed((OUT / "index.html").read_text())
    for file in (OUT / "src").glob("*.js"):
        for value in re.findall(r"from\s*['\"]([^'\"]+)['\"]", file.read_text()):
            require_asset(value, file.parent)
    manifest = json.loads((OUT / "manifest.webmanifest").read_text())
    if manifest["start_url"] != "./" or manifest["scope"] != "./":
        raise ValueError("PWA scope and start URL must be project-relative")
    for icon in manifest["icons"]:
        require_asset(icon["src"])
    cache_list = re.search(r"const FILES = \[(.*?)\]\.map", sw, re.S)
    if not cache_list:
        raise ValueError("Service-worker app shell could not be verified")
    for value in re.findall(r"'([^']+)'", cache_list.group(1)):
        require_asset(value)
    print(f"Pages artifact verified: {sum(p.is_file() for p in OUT.rglob('*'))} files; version {version}")


if __name__ == "__main__":
    main()
