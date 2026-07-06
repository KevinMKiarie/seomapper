#!/usr/bin/env bash
# commit.bash — bootstrap seomapper git history across feature branches
# Run once from the project root: bash commit.bash
set -euo pipefail

# ── helpers ────────────────────────────────────────────────────────────────
step() { echo; echo "▶ $*"; }
die()  { echo "✗ $*" >&2; exit 1; }

[[ -f package.json ]] || die "Run this script from the seomapper project root."

# ── init ───────────────────────────────────────────────────────────────────
step "Initialising git repository"
git init -b main
git config user.name  "Kevin Kiarie"
git config user.email "kiarie7mbugua@gmail.com"

# ── main — project skeleton ─────────────────────────────────────────────────
step "main — project skeleton"
git add \
  package.json \
  package-lock.json \
  tsconfig.json \
  .gitignore \
  LICENSE \
  README.md
git commit -m "chore: initial project setup

Add package.json, tsconfig (Node16 ESM), MIT licence, and README."

# ── feat/core — types, scoring, scanner ────────────────────────────────────
step "feat/core — types, scoring, scanner"
git checkout -b feat/core
git add \
  src/types.ts \
  src/scoring.ts \
  src/scanner.ts
git commit -m "feat(core): add types, weighted scoring engine, and BFS scanner

- types.ts   — ParsedPage, ScanResult, ScanConfig, Issue interfaces
- scoring.ts — 51-rule RULE_WEIGHTS table, calculateScore(), quickWins()
- scanner.ts — BFS crawler with cross-page duplicate detection post-pass"

# ── feat/utils — SSRF guard and URL resolver ────────────────────────────────
step "feat/utils — SSRF guard and URL resolver"
git checkout main
git checkout -b feat/utils
git add \
  src/utils/ssrf.ts \
  src/utils/url.ts
git commit -m "feat(utils): add SSRF protection and URL resolver

- ssrf.ts — blocks private/loopback IPs and reserved ranges before fetch
- url.ts  — resolveUrl() normalises bare hostnames, validates scheme"

# ── feat/crawler — static fetcher and SPA browser ───────────────────────────
step "feat/crawler — static + SPA crawlers"
git checkout main
git checkout -b feat/crawler
git add \
  src/crawler/static.ts \
  src/crawler/browser.ts \
  src/crawler/detect.ts
git commit -m "feat(crawler): streaming static fetcher and Playwright SPA renderer

- static.ts  — streaming fetch with 500 KB head + 200 KB body budget,
               Content-Length pre-check, AbortController timeout
- browser.ts — headless Chromium via Playwright; same size budget applied
               post-render; strips trailing UTF-8 replacement chars
- detect.ts  — heuristic to classify pages as static vs SPA"

# ── feat/rules — all SEO rule checkers ─────────────────────────────────────
step "feat/rules — SEO rule checkers"
git checkout main
git checkout -b feat/rules
git add \
  src/rules/index.ts \
  src/rules/meta.ts \
  src/rules/structure.ts \
  src/rules/schema.ts \
  src/rules/content.ts \
  src/rules/security.ts \
  src/rules/ai-search.ts \
  src/rules/cross-page.ts
git commit -m "feat(rules): implement 51 SEO + AEO rule checkers

- meta.ts       — title, description, OG, Twitter Card, html-lang, favicon
- structure.ts  — H1, headings, alt text, canonical, links, meta-refresh
- schema.ts     — JSON-LD validation (handles array-wrapped blocks)
- content.ts    — thin content, generic anchors, semantic HTML, freshness
- security.ts   — HTTPS headers, mixed content detection
- ai-search.ts  — Speakable, VideoObject, Product, FAQPage, Article, Breadcrumbs
- cross-page.ts — duplicate title/description across all scanned pages"

# ── feat/reporters — CLI, JSON, HTML output ──────────────────────────────────
step "feat/reporters — output formatters"
git checkout main
git checkout -b feat/reporters
git add \
  src/reporter/cli.ts \
  src/reporter/json.ts \
  src/reporter/html.ts
git commit -m "feat(reporters): add CLI table, JSON, and self-contained HTML reporters

- cli.ts  — colour-coded table, per-page scores, quick-wins summary
- json.ts — machine-readable output, safe for CI pipelines
- html.ts — standalone report with inline CSS, collapsible cards, AI blocks"

# ── feat/ai-providers — Claude, Gemini, OpenAI enrichment ────────────────────
step "feat/ai-providers — AI enrichment"
git checkout main
git checkout -b feat/ai-providers
git add \
  src/ai/provider.ts \
  src/ai/utils.ts \
  src/ai/claude.ts \
  src/ai/gemini.ts \
  src/ai/openai.ts
git commit -m "feat(ai): add Claude, Gemini, and OpenAI suggestion providers

- provider.ts — AIProvider interface
- utils.ts    — shared extractPageContext, parseAiResponse, RawSuggestion
- claude.ts   — Anthropic SDK, claude-sonnet-4-6
- gemini.ts   — Google Generative AI, gemini-1.5-flash
- openai.ts   — OpenAI SDK, gpt-4o"

# ── feat/cli — CLI entry point and commands ──────────────────────────────────
step "feat/cli — CLI entry point and commands"
git checkout main
git checkout -b feat/cli
git add \
  src/cli.ts \
  src/commands/init.ts \
  src/commands/watch.ts
git commit -m "feat(cli): wire scan, watch, init, and serve commands

- cli.ts        — Commander program; --depth, --output, --ai, --threshold, --open
- init.ts       — interactive @clack/prompts wizard, writes .seomapperrc.json
- watch.ts      — re-scans on a timer, diffs issues between runs"

# ── feat/mcp — MCP server ──────────────────────────────────────────────────
step "feat/mcp — MCP server"
git checkout main
git checkout -b feat/mcp
git add src/mcp.ts
git commit -m "feat(mcp): expose seomapper as an MCP server

Implements scan_page and list_rules tools over StdioServerTransport.
Registers all 51 rules in the SEO_RULES registry for AI clients."

# ── back to main ────────────────────────────────────────────────────────────
git checkout main

echo
echo "✓ Done. Branches created:"
git branch
echo
echo "Next steps:"
echo "  1. Push to GitHub:  git remote add origin <your-repo-url>"
echo "  2. Push all:        git push -u origin main && git push --all"
echo "  3. Open PRs on GitHub for each feat/* branch."
