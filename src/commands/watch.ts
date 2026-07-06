import chalk from 'chalk';
import ora from 'ora';
import { scan } from '../scanner.js';
import { ScanResult, ScanConfig } from '../types.js';
import { reportCli } from '../reporter/cli.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function diffResults(prev: ScanResult, next: ScanResult): void {
  const prevIssues = new Map<string, Set<string>>();
  const nextIssues = new Map<string, Set<string>>();

  for (const page of prev.pages) {
    prevIssues.set(page.url, new Set(page.issues.map(i => i.rule)));
  }
  for (const page of next.pages) {
    nextIssues.set(page.url, new Set(page.issues.map(i => i.rule)));
  }

  const fixed: string[] = [];
  const regressed: string[] = [];

  // Only diff pages that appear in both scans — newly discovered or dropped pages
  // would produce noisy false positives/negatives in the diff
  for (const [url, nextRules] of nextIssues) {
    const prevRules = prevIssues.get(url);
    if (!prevRules) continue; // new page this scan — skip
    for (const rule of nextRules) {
      if (!prevRules.has(rule)) regressed.push(`${url}  ${chalk.dim(rule)}`);
    }
  }
  for (const [url, prevRules] of prevIssues) {
    const nextRules = nextIssues.get(url);
    if (!nextRules) continue; // page dropped this scan — skip
    for (const rule of prevRules) {
      if (!nextRules.has(rule)) fixed.push(`${url}  ${chalk.dim(rule)}`);
    }
  }

  if (fixed.length === 0 && regressed.length === 0) {
    console.log(chalk.dim('  No changes since last scan.\n'));
    return;
  }

  if (fixed.length > 0) {
    console.log(chalk.green(`\n  Fixed (${fixed.length})`));
    fixed.forEach(l => console.log(`    ${chalk.green('✓')} ${l}`));
  }
  if (regressed.length > 0) {
    console.log(chalk.red(`\n  New issues (${regressed.length})`));
    regressed.forEach(l => console.log(`    ${chalk.red('✗')} ${l}`));
  }
  console.log();
}

export async function runWatch(url: string, config: ScanConfig, intervalSecs: number): Promise<void> {
  console.log(chalk.bold(`\nWatching ${url}  (every ${intervalSecs}s — Ctrl+C to stop)\n`));

  let prevResult: ScanResult | null = null;
  let iteration = 0;

  process.on('SIGINT', () => {
    console.log(chalk.dim('\nWatch stopped.'));
    process.exit(0);
  });

  while (true) {
    iteration += 1;
    const spinner = ora(`Scan #${iteration}…`).start();

    try {
      const result = await scan(url, config);
      spinner.stop();

      const avgScore = result.pages.length
        ? Math.round(result.pages.reduce((s, p) => s + p.score, 0) / result.pages.length)
        : 0;

      const ts = new Date().toLocaleTimeString();
      console.log(chalk.dim(`[${ts}]`) + `  avg score: ${chalk.bold(String(avgScore))}/100  ·  ${result.totalIssues} issues`);

      if (prevResult) {
        diffResults(prevResult, result);
      } else {
        reportCli(result);
      }

      prevResult = result;
    } catch (err) {
      spinner.fail(`Scan failed: ${(err as Error).message}`);
    }

    console.log(chalk.dim(`Next scan in ${intervalSecs}s…\n`));
    await sleep(intervalSecs * 1000);
  }
}
