# seomapper

> SEO audit and AI-enhancement CLI for any tech stack — static sites, SPAs, Next.js, Nuxt, Rails, Django, and more.

[![npm version](https://img.shields.io/npm/v/seomapper.svg)](https://www.npmjs.com/package/seomapper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

Built by [ Kevin Kiarie](https://github.com/KevinMKiarie).

---

## What it does

seomapper crawls any live website, runs 51 SEO and AEO rule checks across every page, scores each page 0–100, and reports what to fix. Optionally, it enriches every issue with an AI explanation and a ready-to-paste code fix from Claude, Gemini, or OpenAI.

**Rule categories**

| Category | Examples |
|---|---|
| Meta tags | title length, meta description, Open Graph, Twitter Card, html lang, favicon |
| Structure | H1 uniqueness, heading order, alt text, canonical URL, meta-refresh |
| JSON-LD | schema present, `@context`, `@type`, invalid JSON, array-wrapped blocks |
| Content | thin content (<300 words), generic anchor text, semantic HTML, content freshness |
| Security | HTTPS headers, mixed content, CSP, HSTS |
| AI Search (AEO) | FAQPage, Article, Breadcrumbs, Speakable, VideoObject, Product, E-E-A-T |
| Cross-page | duplicate titles, duplicate meta descriptions |
| Site files | robots.txt, sitemap.xml |
| Links | nofollow on internal links, hreflang |

---

## Installation

```bash
# No install needed — just run
npx seomapper scan yoursite.com

# Install globally for repeated use
npm install -g seomapper
seomapper scan yoursite.com

# Add to a specific project (no global install)
npm install seomapper
npx seomapper scan yoursite.com
```

**Project-level usage** — add to your `package.json` scripts so the whole team shares the same version and flags:

```json
"scripts": {
  "seo": "seomapper scan https://yoursite.com",
  "seo:ci": "seomapper scan https://yoursite.com --threshold 80"
}
```

```bash
npm run seo
```

Node.js 18 or newer is required.

> **nvm users:** if `seomapper` is not found after a global install, add npm's bin to your PATH:
> ```bash
> echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
> ```
`
---

## Quick start

```bash
# Interactive setup wizard — saves defaults to .seomapperrc.json
seomapper init

# Scan a site (CLI table output)
seomapper scan yoursite.com

# Scan and open a full HTML report in your browser
seomapper scan yoursite.com --output html --open

# Scan with AI-powered fix suggestions
seomapper scan yoursite.com --ai claude

# Watch a site and diff issues every 60 seconds
seomapper watch yoursite.com --interval 60
```

---

## Commands

### `seomapper init`

Runs an interactive wizard that asks how many pages to scan by default and which output format to use, then saves your choices to `.seomapperrc.json` in the current directory.

### `seomapper scan <url>`

Crawls the site starting from `<url>` and reports SEO issues.

| Flag | Default | Description |
|---|---|---|
| `-d, --depth <n>` | 100 | Maximum number of pages to crawl |
| `-o, --output <format>` | cli | `cli`, `json`, or `html` |
| `-f, --file <path>` | `seomapper-report.html` | Output file path (HTML mode) |
| `--ignore <rules>` | — | Comma-separated rule IDs to skip |
| `--ai <provider>` | — | Enrich with AI: `claude`, `gemini`, `openai` |
| `--threshold <score>` | — | Exit 1 if average score is below this (useful in CI) |
| `--open` | — | Open the HTML report in your browser after scanning |

### `seomapper watch <url>`

Re-scans a URL on a timer and shows only what changed between runs.

| Flag | Default | Description |
|---|---|---|
| `-d, --depth <n>` | 100 | Max pages per scan |
| `-i, --interval <s>` | 30 | Seconds between scans |
| `--ignore <rules>` | — | Comma-separated rule IDs to skip |

### `seomapper serve`

Starts seomapper as an MCP (Model Context Protocol) server. Use this with Claude Desktop, Cursor, or any MCP-compatible AI client to run SEO audits directly from your editor or chat.

---

## AI suggestions

Passing `--ai` fetches each page's HTML, sends the issues and page context to the AI, and attaches a one-sentence explanation plus a copy-pasteable code snippet to each issue.

```bash
# Claude (requires ANTHROPIC_API_KEY)
ANTHROPIC_API_KEY=sk-... seomapper scan yoursite.com --ai claude

# Gemini (requires GEMINI_API_KEY)
GEMINI_API_KEY=... seomapper scan yoursite.com --ai gemini

# OpenAI (requires OPENAI_API_KEY)
OPENAI_API_KEY=sk-... seomapper scan yoursite.com --ai openai
```

---

## MCP server (for AI editors)

seomapper can expose its scanner as an MCP tool so AI assistants can audit pages on your behalf.

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "seomapper": {
      "command": "npx",
      "args": ["seomapper", "serve"]
    }
  }
}
```

**Cursor** — add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "seomapper": {
      "command": "npx",
      "args": ["seomapper", "serve"]
    }
  }
}
```

Once connected, your AI assistant gains two tools:

- `scan_page` — audits a URL and returns structured issues with scores
- `list_rules` — returns the full catalogue of 51 rule IDs and descriptions

---

## Config file

Running `seomapper init` creates `.seomapperrc.json`. You can also create it manually:

```json
{
  "depth": 50,
  "output": "html"
}
```

`depth` accepts a number or `"auto"` (crawls up to 100 pages or until none remain).

---

## CI integration

Use `--threshold` to fail your pipeline if SEO quality drops:

```yaml
# GitHub Actions example
- name: SEO audit
  run: npx seomapper scan https://yoursite.com --threshold 70
```

Exit code is `1` when the average score is below the threshold, `0` otherwise.

---

## Output formats

**CLI** — colour-coded table printed directly in the terminal with a quick-wins summary at the bottom.

**HTML** — self-contained single-file report with inline CSS. No server required — share it as an email attachment or artifact.

**JSON** — machine-readable output piped to a file or another tool:

```bash
seomapper scan yoursite.com --output json > report.json
```

---

## How scoring works

Each page starts at 100. Every detected issue deducts a fixed number of points based on its actual SEO impact, not just its severity label.

| Weight | Example rules |
|---|---|
| 25 pts | `title-missing`, `schema-missing`, `canonical-missing` |
| 20 pts | `description-missing`, `h1-missing`, `robots-noindex` |
| 15 pts | `og-title-missing`, `schema-no-type`, `https-missing` |
| 10 pts | `alt-text-missing`, `thin-content`, `duplicate-title` |
| 5 pts | `twitter-card-missing`, `favicon-missing`, `html-lang-missing` |

Scores are clamped to `[0, 100]`. The quick-wins section surfaces which rule fixes would recover the most points across the most pages.

---

## Large sites and heavy pages

seomapper applies a streaming budget to every page:

- Only the `<head>` plus the first 200 KB of `<body>` is parsed — enough for every SEO signal.
- A 50 MB hard ceiling on Content-Length rejects oversized responses before they start streaming.
- JavaScript-rendered (SPA) pages use headless Chromium with the same budget applied post-render.

This keeps memory flat even on sites with hundreds of pages.

---

## Contributing

Issues and pull requests are welcome. Please open an issue first for anything beyond a small bug fix so we can align on the approach.

```bash
git clone https://github.com/KevinMKiarie/seomapper
cd seomapper
npm install
npm run build
node dist/cli.js scan yoursite.com
```

---

## License

MIT — see [LICENSE](LICENSE).

Copyright (c) 2025 [Kiarie Mbugua](https://github.com/KevinMKiarie).
