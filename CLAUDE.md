# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A static-site generator for SRE / DevOps incident runbooks. Author writes YAML, `build.py` renders it to plain HTML in `dist/`. Target reader is a **solo on-call engineer paged at 3 AM** — every design choice (schema order, "am I in the right runbook?" split, freshness badge, sticky search) defers to that.

## Commands

```sh
# One-time setup
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Rebuild dist/ from runbooks/ + templates/ + assets/
python3 build.py

# Add a new runbook
cp runbooks/_template.yaml runbooks/<category>/<slug>.yaml
# edit the YAML (every placeholder is in [square brackets])
python3 build.py
open dist/<category>/<slug>.html

# Serve locally (also works via file:// — see "Local viewing" below)
python3 -m http.server -d dist 8000
```

There are no tests, no linter, and no CI. `build.py` prints how many runbooks were rendered; if a template error surfaces, Jinja2 raises with a file/line.

## Architecture

Three source trees feed one generator:

- `runbooks/*.yaml` — content, source of truth. Subdirectories become URL categories (`runbooks/api/5xx.yaml` → `dist/api/5xx.html`). Files whose name starts with `_` are skipped by the builder — that's why `_template.yaml` stays out of `dist/`. Two special top-level files, `runbooks/index.yaml` and `runbooks/severity.yaml`, feed the landing and severity pages.
- `templates/*.html.j2` — Jinja2 layout. `_base.html.j2` owns the shell (head, header, footer, script tags); `runbook.html.j2` renders one runbook. Partials `_header.html.j2` / `_footer.html.j2` are included by `_base`.
- `assets/{styles.css, search.js}` — copied verbatim into `dist/assets/`. `assets/search-index.js` is **generated**, not copied — never hand-edit `dist/assets/search-index.js`, it is overwritten on every build.

`build.py` is ~150 lines and holds no logic beyond: load YAML → render templates → write files → regenerate the search index from every runbook's `title` + `tags` + `snippet`. The severity page is added to the search index in `write_search_index`.

## Non-obvious things

- **YAML is the source of truth.** Never edit `dist/*.html` — the next build wipes it.
- **Missing YAML keys render as empty strings.** The Jinja env uses `ChainableUndefined`, not `StrictUndefined`. This is deliberate: fields are optional, and guarding every access with `.get()` bloated the template. Cost: typos in field names silently render nothing — spot-check the output when you add or rename a field.
- **Inline HTML is allowed in every YAML string value.** Rendered via `| safe`. Used for `<code>`, `<a>`, `<em>`, `<strong>` — anywhere richer than plain text. There is no sanitization; content is author-controlled.
- **Slug references are not validated.** `not_here_if[].link` and `related.runbooks[]` point to slugs like `database/replication-lag` (no `.html`). The build does not check these resolve, so broken links can ship silently. If you add validation, do it in `build.py` after `load_runbooks()`.
- **Local viewing via `file://` is a hard requirement.** That's why `assets/search-index.js` is a JS file that assigns to `window.SRE_INDEX`, not a JSON file behind `fetch()`. `fetch()` on `file://` is blocked by Chrome — do not switch the index back to JSON.
- **The 12-section runbook schema is canonical.** `runbooks/_template.yaml` is the definitive list of fields and comments explaining each. When someone asks "does the schema have field X?", read `_template.yaml`, not the template files.
- **URL depth is derived from source path.** `_root` and `_root_data` in each runbook dict are set in `load_runbooks()` and passed to Jinja to build correct `../` prefixes for asset and nav links. If you add a nested category (e.g. `runbooks/api/auth/foo.yaml`), the depth-2 case is already handled.
- **`assets/styles.css` uses `data-theme` overrides** on `:root` for a manual light/dark toggle, layered on top of `prefers-color-scheme`. `assets/search.js` persists the choice to `localStorage`.

## Foreign-agent configs on this machine

There's an OpenAI Codex config at `~/.codex/` and a Gemini CLI config at `~/.gemini/`. If you want to bring their MCP servers, slash commands, or subagents into Claude Code, reply `/import` to scan and list what's importable, then `/import --yes=<digest>` to apply. If `/import` isn't available on this surface, run `claude import` from a terminal.
