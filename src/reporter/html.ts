import { writeFileSync } from 'fs';
import { join } from 'path';
import { ScanResult, Issue, Severity } from '../types.js';
import { quickWins } from '../scoring.js';

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function severityColor(s: Severity): string {
  if (s === 'error') return '#ef4444';
  if (s === 'warning') return '#f59e0b';
  return '#3b82f6';
}

function severityBg(s: Severity): string {
  if (s === 'error') return '#fef2f2';
  if (s === 'warning') return '#fffbeb';
  return '#eff6ff';
}

function renderIssue(issue: Issue, idx: number): string {
  const color = severityColor(issue.severity);
  const bg = severityBg(issue.severity);
  const ai = issue.aiSuggestion;
  const aiBlock = ai
    ? `<div class="ai-block">
        <div class="ai-label">AI Suggestion</div>
        <p class="ai-explanation">${escHtml(ai.explanation)}</p>
        ${ai.codefix ? `<pre class="codefix"><code>${escHtml(ai.codefix)}</code></pre>` : ''}
      </div>`
    : '';
  return `
    <div class="issue" style="border-left:4px solid ${color};background:${bg}">
      <div class="issue-header">
        <span class="badge" style="background:${color}">${escHtml(issue.severity)}</span>
        <span class="rule-id">${escHtml(issue.rule)}</span>
      </div>
      <p class="issue-msg">${escHtml(issue.message)}</p>
      <p class="issue-fix"><strong>Fix:</strong> ${escHtml(issue.fix)}</p>
      ${aiBlock}
    </div>`;
}

function renderPage(page: ScanResult['pages'][number], idx: number): string {
  const color = scoreColor(page.score);
  const errors = page.issues.filter(i => i.severity === 'error').length;
  const warnings = page.issues.filter(i => i.severity === 'warning').length;
  const issuesHtml = page.issues.length
    ? page.issues.map((iss, i) => renderIssue(iss, i)).join('')
    : '<p class="no-issues">No issues found</p>';

  return `
    <details class="page-card" ${idx === 0 ? 'open' : ''}>
      <summary class="page-summary">
        <span class="page-type">${escHtml(page.type.toUpperCase())}</span>
        <span class="page-url">${escHtml(page.url)}</span>
        <span class="badges">
          ${errors ? `<span class="badge" style="background:#ef4444">${errors} error${errors !== 1 ? 's' : ''}</span>` : ''}
          ${warnings ? `<span class="badge" style="background:#f59e0b">${warnings} warning${warnings !== 1 ? 's' : ''}</span>` : ''}
        </span>
        <span class="score" style="color:${color}">${page.score}/100</span>
      </summary>
      <div class="issues-list">${issuesHtml}</div>
    </details>`;
}

function buildHtml(result: ScanResult): string {
  const allIssues = result.pages.flatMap(p => p.issues);
  const errors = allIssues.filter(i => i.severity === 'error').length;
  const warnings = allIssues.filter(i => i.severity === 'warning').length;
  const avgScore = result.pages.length
    ? Math.round(result.pages.reduce((s, p) => s + p.score, 0) / result.pages.length)
    : 0;
  const avgColor = scoreColor(avgScore);
  const hasAI = allIssues.some(i => i.aiSuggestion);

  const pagesHtml = result.pages.map((p, i) => renderPage(p, i)).join('');
  const wins = quickWins(result);
  const winsHtml = wins.length > 0
    ? `<div class="wins">
        <h2 class="wins-title">Quick wins</h2>
        <p class="wins-sub">Fix these first — highest score impact across all pages.</p>
        <ol class="wins-list">
          ${wins.map(w => `
            <li class="win-item">
              <div class="win-left">
                <span class="win-rule">${escHtml(w.rule)}</span>
                <span class="win-msg">${escHtml(w.message)}</span>
              </div>
              <div class="win-right">
                <span class="win-pages">${w.pagesAffected} page${w.pagesAffected !== 1 ? 's' : ''}</span>
                <span class="win-gain">+${w.totalGain} pts</span>
              </div>
            </li>`).join('')}
        </ol>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SEO Report — ${escHtml(result.startUrl)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; }
    a { color: #3b82f6; }

    /* Header */
    .header { background: #0f172a; color: #f1f5f9; padding: 2rem; }
    .header h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: .25rem; }
    .header .meta { font-size: .875rem; color: #94a3b8; }

    /* Summary bar */
    .summary { display: flex; gap: 1.5rem; flex-wrap: wrap; padding: 1.5rem 2rem; background: #fff; border-bottom: 1px solid #e2e8f0; }
    .stat { display: flex; flex-direction: column; align-items: center; min-width: 90px; }
    .stat-value { font-size: 2rem; font-weight: 700; line-height: 1; }
    .stat-label { font-size: .75rem; color: #64748b; text-transform: uppercase; letter-spacing: .05em; margin-top: .25rem; }

    /* AI badge */
    .ai-notice { padding: .5rem 2rem; background: #faf5ff; border-bottom: 1px solid #e9d5ff; font-size: .825rem; color: #7c3aed; }

    /* Pages */
    .pages { padding: 1.5rem 2rem; max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem; }

    .page-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .page-summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: .75rem; padding: .875rem 1.25rem; user-select: none; }
    .page-summary::-webkit-details-marker { display: none; }
    .page-summary::before { content: '▶'; font-size: .7rem; color: #94a3b8; transition: transform .15s; flex-shrink: 0; }
    details[open] .page-summary::before { transform: rotate(90deg); }
    .page-type { font-size: .7rem; font-weight: 600; background: #f1f5f9; color: #475569; border-radius: 4px; padding: .1rem .45rem; flex-shrink: 0; }
    .page-url { font-size: .875rem; font-weight: 500; flex: 1; word-break: break-all; }
    .score { font-size: 1.1rem; font-weight: 700; flex-shrink: 0; }
    .badges { display: flex; gap: .4rem; flex-wrap: wrap; }

    .badge { font-size: .7rem; font-weight: 600; color: #fff; border-radius: 4px; padding: .15rem .5rem; }

    .issues-list { padding: 1rem 1.25rem; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: .75rem; }
    .no-issues { color: #22c55e; font-size: .875rem; padding: .5rem 0; }

    /* Issue cards */
    .issue { border-radius: 6px; padding: .875rem 1rem; }
    .issue-header { display: flex; align-items: center; gap: .6rem; margin-bottom: .4rem; }
    .rule-id { font-size: .8rem; font-family: monospace; color: #475569; }
    .issue-msg { font-size: .875rem; margin-bottom: .3rem; }
    .issue-fix { font-size: .825rem; color: #475569; }

    /* AI block */
    .ai-block { margin-top: .75rem; padding: .75rem; background: #faf5ff; border-radius: 6px; border: 1px solid #e9d5ff; }
    .ai-label { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #7c3aed; margin-bottom: .3rem; }
    .ai-explanation { font-size: .825rem; color: #4c1d95; margin-bottom: .4rem; }
    .codefix { background: #1e1b4b; color: #c4b5fd; font-size: .8rem; border-radius: 6px; padding: .75rem 1rem; overflow-x: auto; white-space: pre; }

    /* Quick wins */
    .wins { max-width: 1100px; margin: 0 auto; padding: 0 2rem 1.5rem; }
    .wins-title { font-size: 1rem; font-weight: 700; margin-bottom: .25rem; }
    .wins-sub { font-size: .825rem; color: #64748b; margin-bottom: 1rem; }
    .wins-list { list-style: none; display: flex; flex-direction: column; gap: .5rem; }
    .win-item { display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: .75rem 1rem; gap: 1rem; }
    .win-left { display: flex; flex-direction: column; gap: .15rem; }
    .win-rule { font-size: .8rem; font-family: monospace; color: #0f172a; font-weight: 600; }
    .win-msg { font-size: .8rem; color: #64748b; }
    .win-right { display: flex; align-items: center; gap: .75rem; flex-shrink: 0; }
    .win-pages { font-size: .75rem; color: #94a3b8; }
    .win-gain { font-size: .875rem; font-weight: 700; color: #16a34a; }

    /* Footer */
    .footer { text-align: center; padding: 2rem; font-size: .8rem; color: #94a3b8; }
  </style>
</head>
<body>

<div class="header">
  <h1>SEO Audit Report</h1>
  <div class="meta">${escHtml(result.startUrl)} &nbsp;·&nbsp; ${escHtml(result.scannedAt)}</div>
</div>

<div class="summary">
  <div class="stat">
    <span class="stat-value" style="color:${avgColor}">${avgScore}</span>
    <span class="stat-label">Avg Score</span>
  </div>
  <div class="stat">
    <span class="stat-value">${result.pagesScanned}</span>
    <span class="stat-label">Pages</span>
  </div>
  <div class="stat">
    <span class="stat-value" style="color:#ef4444">${errors}</span>
    <span class="stat-label">Errors</span>
  </div>
  <div class="stat">
    <span class="stat-value" style="color:#f59e0b">${warnings}</span>
    <span class="stat-label">Warnings</span>
  </div>
  <div class="stat">
    <span class="stat-value">${allIssues.length - errors - warnings}</span>
    <span class="stat-label">Info</span>
  </div>
</div>

${hasAI ? '<div class="ai-notice">✦ This report includes AI-powered fix suggestions</div>' : ''}

${winsHtml}

<div class="pages">${pagesHtml}</div>

<div class="footer">Generated by seomapper</div>

</body>
</html>`;
}

export function reportHtml(result: ScanResult, outPath?: string): void {
  const filePath = outPath ?? join(process.cwd(), 'seomapper-report.html');
  writeFileSync(filePath, buildHtml(result), 'utf-8');
  process.stdout.write(`\nHTML report saved to ${filePath}\n`);
}
