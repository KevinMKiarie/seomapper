import chalk from 'chalk';
import Table from 'cli-table3';
import { ScanResult, Issue, Severity } from '../types.js';
import { quickWins } from '../scoring.js';

function colorBySeverity(severity: Severity): string {
  if (severity === 'error') return chalk.red(severity);
  if (severity === 'warning') return chalk.yellow(severity);
  return chalk.blue(severity);
}

function colorByScore(score: number): string {
  if (score >= 80) return chalk.green(String(score));
  if (score >= 50) return chalk.yellow(String(score));
  return chalk.red(String(score));
}

function printCodefix(codefix: string): void {
  const lines = codefix.trim().split('\n');
  if (lines.every(l => !l.trim())) return;
  const maxLen = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const width = Math.min(maxLen + 4, 80);
  const bar = chalk.dim('─'.repeat(width));
  console.log(`  ${bar}`);
  for (const line of lines) {
    console.log(`  ${chalk.green(line)}`);
  }
  console.log(`  ${bar}`);
}

function printPageIssues(issues: Issue[]): void {
  if (issues.length === 0) {
    console.log(chalk.green('  No issues found\n'));
    return;
  }

  const table = new Table({
    head: [
      chalk.bold('Severity'),
      chalk.bold('Rule'),
      chalk.bold('Message'),
      chalk.bold('Fix'),
    ],
    colWidths: [10, 30, 42, 42],
    wordWrap: true,
  });

  for (const issue of issues) {
    table.push([
      colorBySeverity(issue.severity),
      chalk.dim(issue.rule),
      issue.message,
      chalk.cyan(issue.fix),
    ]);
  }

  console.log(table.toString());

  // AI suggestions block — only rendered when --ai flag was used
  const withAI = issues.filter(i => i.aiSuggestion);
  if (withAI.length === 0) return;

  console.log(`\n  ${chalk.bold.magenta('AI Suggestions')}`);
  console.log(`  ${chalk.dim('─'.repeat(60))}`);

  for (const issue of withAI) {
    const { explanation, codefix } = issue.aiSuggestion!;
    console.log(`\n  ${chalk.magenta('◆')} ${chalk.bold(issue.rule)}`);
    console.log(`    ${chalk.dim(explanation)}`);
    if (codefix) {
      console.log(`\n  ${chalk.dim('Suggested code:')}`);
      printCodefix(codefix);
    }
  }

  console.log();
}

export function reportCli(result: ScanResult): void {
  console.log();
  console.log(chalk.bold.underline(`SEO Scan — ${result.startUrl}`));
  console.log(
    chalk.dim(
      `${result.pagesScanned} pages · ${result.totalIssues} issues · ${result.scannedAt}`
    )
  );
  console.log();

  for (const page of result.pages) {
    const typeBadge = chalk.dim(`[${page.type.toUpperCase()}]`);
    const score = colorByScore(page.score);
    console.log(`${typeBadge} ${chalk.bold(page.url)}  score: ${score}/100`);
    printPageIssues(page.issues);
  }

  const allIssues = result.pages.flatMap(p => p.issues);
  const errors   = allIssues.filter(i => i.severity === 'error').length;
  const warnings = allIssues.filter(i => i.severity === 'warning').length;
  const avgScore = result.pages.length
    ? Math.round(result.pages.reduce((s, p) => s + p.score, 0) / result.pages.length)
    : 0;

  console.log(chalk.bold('Summary'));
  console.log(`  Average score : ${colorByScore(avgScore)}/100`);
  console.log(`  Errors        : ${chalk.red(String(errors))}`);
  console.log(`  Warnings      : ${chalk.yellow(String(warnings))}`);
  console.log(`  Pages scanned : ${result.pagesScanned}`);
  console.log();

  const wins = quickWins(result);
  if (wins.length > 0) {
    console.log(chalk.bold('Quick wins  ') + chalk.dim('(highest score impact)'));
    wins.forEach((w, i) => {
      const pages = w.pagesAffected > 1 ? `×${w.pagesAffected} pages` : '×1 page';
      console.log(
        `  ${chalk.dim(String(i + 1) + '.')} ${chalk.cyan(w.rule)}` +
        `  ${chalk.dim(pages)}` +
        `  ${chalk.green(`+${w.totalGain} pts`)}`
      );
    });
    console.log();
  }
}
