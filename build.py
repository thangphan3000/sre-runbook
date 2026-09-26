#!/usr/bin/env python3
"""Build the SRE runbook site from YAML sources into dist/.

Usage:
    python3 build.py

Layout:
    runbooks/            YAML sources (one file per runbook, plus index.yaml
                         and severity.yaml for the landing + severity pages).
                         Subdirectories become URL categories: api/, database/,
                         infra/, pipelines/. Files whose names start with _
                         (e.g. _template.yaml) are skipped.
    templates/           Jinja2 templates (*.html.j2 + _base/_header/_footer).
    assets/              Static files copied verbatim to dist/assets/.
    dist/                Generated site. Open dist/index.html.
"""
from __future__ import annotations

import json
import shutil
import sys
from collections import defaultdict
from pathlib import Path

import yaml
from jinja2 import ChainableUndefined, Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).parent
SRC_RUNBOOKS = ROOT / "runbooks"
SRC_TEMPLATES = ROOT / "templates"
SRC_ASSETS = ROOT / "assets"
DIST = ROOT / "dist"

SPECIAL = {"index.yaml", "severity.yaml"}


def load_yaml(path: Path) -> dict:
    with path.open() as f:
        data = yaml.safe_load(f) or {}
    if not isinstance(data, dict):
        raise SystemExit(f"{path}: top-level must be a mapping, got {type(data).__name__}")
    return data


def load_runbooks() -> list[dict]:
    runbooks = []
    for p in sorted(SRC_RUNBOOKS.rglob("*.yaml")):
        rel = p.relative_to(SRC_RUNBOOKS)
        if rel.name.startswith("_"):
            continue
        if rel.name in SPECIAL and len(rel.parts) == 1:
            continue
        data = load_yaml(p)
        depth = len(rel.parts) - 1
        data["_src"] = str(rel)                              # e.g. api/5xx-error-rate.yaml
        data["_path"] = str(rel.with_suffix(".html"))        # e.g. api/5xx-error-rate.html
        data["_category"] = rel.parts[0] if depth > 0 else ""
        data["_root"] = "../" * depth                        # href prefix from this page
        data["_root_data"] = "." if depth == 0 else "/".join([".."] * depth)
        runbooks.append(data)
    return runbooks


def build_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(SRC_TEMPLATES),
        autoescape=select_autoescape(["html"]),
        undefined=ChainableUndefined,  # missing YAML fields render as empty
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True,
    )


def render_runbook(env: Environment, rb: dict) -> None:
    tmpl = env.get_template("runbook.html.j2")
    html = tmpl.render(
        rb=rb,
        root=rb["_root"],
        root_data=rb["_root_data"],
        description=rb.get("snippet"),
    )
    out = DIST / rb["_path"]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)


def render_index(env: Environment, runbooks: list[dict]) -> None:
    data = load_yaml(SRC_RUNBOOKS / "index.yaml")
    grouped: dict[str, list[dict]] = defaultdict(list)
    for rb in runbooks:
        grouped[rb["_category"]].append(rb)
    tmpl = env.get_template("index.html.j2")
    html = tmpl.render(
        data=data,
        runbooks=runbooks,
        grouped=grouped,
        root="",
        root_data=".",
        description=data.get("lede"),
    )
    (DIST / "index.html").write_text(html)


def render_severity(env: Environment) -> None:
    data = load_yaml(SRC_RUNBOOKS / "severity.yaml")
    tmpl = env.get_template("severity.html.j2")
    html = tmpl.render(data=data, root="", root_data=".", description=data.get("snippet"))
    (DIST / "severity.html").write_text(html)


def write_search_index(runbooks: list[dict]) -> None:
    items = [
        {
            "title": rb["title"],
            "url": rb["_path"],
            "tags": rb.get("tags", []),
            "snippet": rb.get("snippet", ""),
        }
        for rb in runbooks
    ]
    # Add the reference pages so search can find them too.
    severity = load_yaml(SRC_RUNBOOKS / "severity.yaml")
    items.append(
        {
            "title": severity.get("title", "Severity levels"),
            "url": "severity.html",
            "tags": severity.get("tags", ["severity", "reference"]),
            "snippet": severity.get("snippet", ""),
        }
    )
    js = "window.SRE_INDEX = " + json.dumps(items, indent=2, ensure_ascii=False) + ";\n"
    (DIST / "assets").mkdir(parents=True, exist_ok=True)
    (DIST / "assets" / "search-index.js").write_text(js)


def copy_assets() -> None:
    dest = DIST / "assets"
    for f in SRC_ASSETS.iterdir():
        if f.name == "search-index.js":
            continue  # regenerated from YAML
        if f.is_file():
            shutil.copy2(f, dest / f.name)


def main() -> int:
    if not SRC_TEMPLATES.exists():
        print("templates/ missing", file=sys.stderr)
        return 1
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    (DIST / "assets").mkdir()
    copy_assets()

    env = build_env()
    runbooks = load_runbooks()

    for rb in runbooks:
        render_runbook(env, rb)

    render_index(env, runbooks)
    render_severity(env)
    write_search_index(runbooks)

    print(f"Built {len(runbooks)} runbook(s) + landing + severity → {DIST}/")
    print(f"Open: file://{(DIST / 'index.html').resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
