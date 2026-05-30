@AGENTS.md

## graphify + Obsidian (knowledge persistence)

Persist project knowledge to the graphify knowledge graph, which also emits an Obsidian vault. "Everything" means code AND the design/decision docs under `docs/superpowers/` (specs, plans, rationale).

- First full build (run once): `graphify . --obsidian` -> writes `graphify-out/` (graph.json, GRAPH_REPORT.md, interactive HTML, Obsidian vault). Add `--obsidian-dir <path>` to target a central Obsidian vault instead of the in-repo default. This step is token-intensive (semantic extraction).
- After modifying code: `graphify update .` to keep the graph current (AST-only, no API cost).
- After adding or changing docs (spec, plan, decisions): re-run `graphify . --obsidian` so the vault and graph reflect the new knowledge (semantic extraction, has API cost).
- For codebase/architecture questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over raw file browsing when `graphify-out/graph.json` exists. Use `graphify-out/GRAPH_REPORT.md` only for broad architecture review.
- Keep all design specs and plans in `docs/superpowers/` so they remain part of the graphify corpus.
