# SRE Runbooks

A tiny static-site generator for incident runbooks. Write YAML, run `python3 build.py`, get a searchable HTML site in `dist/`.

Built for one reader: **a solo on-call engineer paged at 3 AM.** Every design choice — the "am I in the right runbook?" split, the fold-content limit, the freshness badge, sticky search — defers to that.

## Contents

- [Quick start](#quick-start)
- [Adding a new runbook](#adding-a-new-runbook)
- [What each runbook page shows](#what-each-runbook-page-shows)
- [Repo layout](#repo-layout)
- [Design notes worth knowing](#design-notes-worth-knowing)

## Quick start

```sh
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 build.py
open dist/index.html
```

That's it. No dev server needed — the site works over `file://`. If you'd rather serve it:

```sh
python3 -m http.server -d dist 8000
```

## Adding a new runbook

```sh
cp runbooks/_template.yaml runbooks/<category>/<slug>.yaml
# edit — every placeholder is in [square brackets]
python3 build.py
```

Categories are just subdirectories under `runbooks/` (`api/`, `database/`, `infra/`, `pipelines/` — add more as needed). The URL mirrors the source path, so `runbooks/api/tls-cert-expired.yaml` renders to `dist/api/tls-cert-expired.html`.

Search is auto-updated from each runbook's `title`, `tags`, and `snippet` fields — no separate index to maintain.

## What each runbook page shows

Twelve sections, in this order, optimised for 30-second scanning:

1. **Header banner** — title, owner, channel, severity guide, "Verified Nd ago" badge (green < 90d, amber < 180d, red older).
2. **Quick checklist** — the 4–6 things to do, tickable checkboxes.
3. **Am I in the right runbook?** — side-by-side "here if" / "not here if" with links to the correct runbook.
4. **Detection & signals** — alert name, dashboards in the order to open them, SLO context, what a false positive looks like.
5. **Triage** — first 5 minutes. Each step: command → expected → if wrong → prereq.
6. **Mitigation** — grouped safe / reversible / destructive. Destructive actions have dry-run commands and require a 2nd approval.
7. **Verification** — the specific metric and threshold that proves it's over.
8. **Escape hatch** — what to do if mitigation made it worse.
9. **Communication templates** — copy-paste initial, 15-min update, and resolution posts.
10. **Escalation matrix** — time-boxed triggers → who to page → how.
11. **Related** — sibling runbooks, architecture links, prior postmortems.

The canonical schema — every field, with comments — lives in [`runbooks/_template.yaml`](runbooks/_template.yaml).

## Repo layout

```
runbooks/         YAML sources — the source of truth
templates/        Jinja2 layout (HTML)
assets/           styles.css + search.js (copied verbatim)
build.py          the generator (~150 lines)
dist/             generated output (gitignored)
```

Deeper architectural notes are in [`CLAUDE.md`](CLAUDE.md).

## Design notes worth knowing

- **Local viewing over `file://` is a hard requirement.** That's why the search index ships as JS (`search-index.js`, assigning to `window.SRE_INDEX`), not JSON — Chrome blocks `fetch()` from local-file origins.
- **Missing YAML fields render as empty strings.** Every field except the metadata block is optional; delete sections that don't apply.
- **Inline HTML in YAML string values is allowed** and rendered as-is. Use it for links and `<code>` inside prose fields.
- **No framework runtime.** Plain HTML + one CSS file + one JS file. Deploys as a folder of static files anywhere.
- **No tests, no linter, no CI** — this is a personal-scale tool. The build fails loudly on template errors and that's the whole feedback loop.
