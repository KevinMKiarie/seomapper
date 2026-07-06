# Contributing to seomapper

Thanks for taking the time to contribute. Please read this before opening a PR or issue.

## Getting started

```bash
git clone https://github.com/KevinMKiarie/seomapper
cd seomapper
npm install
npm run build
node dist/cli.js scan yoursite.com
```

## Branch model

| Branch | Purpose |
|---|---|
| `main` | Protected. Production-ready code only. Direct pushes are blocked. |
| `feat/<name>` | New features — one feature per branch |
| `fix/<name>` | Bug fixes |
| `docs/<name>` | Documentation-only changes |
| `chore/<name>` | Dependency updates, build config, tooling |

Always branch off `main` and open a PR back to `main`.

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org). Semantic-release reads these messages to determine the version bump and generate the changelog automatically.

| Prefix | When to use | Version bump |
|---|---|---|
| `feat:` | New user-facing feature | minor |
| `fix:` | Bug fix | patch |
| `docs:` | Documentation only | none |
| `chore:` | Build system, deps, CI | none |
| `refactor:` | Code change with no behaviour change | none |
| `perf:` | Performance improvement | patch |
| `test:` | Adding or updating tests | none |

**Breaking changes** — add `BREAKING CHANGE:` in the commit footer or append `!` to the type:

```
feat!: remove --legacy flag

BREAKING CHANGE: The --legacy flag was removed. Use --output json instead.
```

**Examples**

```
feat(rules): add prefers-reduced-motion AEO check
fix(scanner): handle redirect loops gracefully
docs: add MCP quickstart to README
chore(deps): bump playwright to 1.45
```

## Pull request checklist

Before submitting:

- [ ] `npm run build` passes with zero TypeScript errors
- [ ] New rule? Add it to `src/rules/`, wire it in `src/rules/index.ts`, add it to `RULE_WEIGHTS` in `src/scoring.ts`, and register it in the `SEO_RULES` array in `src/mcp.ts`
- [ ] PR title follows Conventional Commit format (`feat:`, `fix:`, etc.)
- [ ] Description explains *why*, not just what changed

## Adding a new SEO rule

1. Pick a rule ID in `kebab-case` (e.g. `robots-noindex-all`)
2. Add the check to the appropriate file in `src/rules/`
3. Export it and wire it into `runRules()` in `src/rules/index.ts`
4. Add a point weight to `RULE_WEIGHTS` in `src/scoring.ts`
5. Register `{ id, category, description }` in `SEO_RULES` in `src/mcp.ts`

## Code style

- TypeScript strict mode — no `any`, no `@ts-ignore`
- No default exports — named exports only
- No comments explaining *what* the code does — only *why* when it's non-obvious
- Match the existing code style; there is no formatter configured so consistency is manual

## Reporting a bug

Open an issue using the bug report template. Include:

- seomapper version (`seomapper --version`)
- Node.js version (`node --version`)
- The exact command you ran
- What you expected vs. what happened

## License

By contributing you agree that your changes will be licensed under the [MIT License](LICENSE).
