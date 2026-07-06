#!/usr/bin/env node
import { Command } from 'commander';
import ora from 'ora';
import { exec } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
) as { version: string };
import { scan } from './scanner.js';
import { resolveUrl } from './utils/url.js';
import { runInit } from './commands/init.js';
import { runWatch } from './commands/watch.js';
import { reportCli } from './reporter/cli.js';
import { reportJson } from './reporter/json.js';
import { reportHtml } from './reporter/html.js';
import { ClaudeProvider } from './ai/claude.js';
import { GeminiProvider } from './ai/gemini.js';
import { OpenAIProvider } from './ai/openai.js';
import type { AIProvider } from './ai/provider.js';

const AUTO_DEPTH = 100;

function openInBrowser(filePath: string): void {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start ""'
    : 'xdg-open';
  exec(`${cmd} "${filePath}"`);
}

interface RcConfig {
  depth?: number | 'auto';
  output?: 'cli' | 'json' | 'html';
}

function loadRc(): RcConfig {
  const rcPath = join(process.cwd(), '.seomapperrc.json');
  if (!existsSync(rcPath)) return {};
  try {
    return JSON.parse(readFileSync(rcPath, 'utf-8')) as RcConfig;
  } catch {
    return {};
  }
}

function createAIProvider(name: string): AIProvider {
  if (name === 'claude') {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for --ai claude');
    return new ClaudeProvider(apiKey);
  }
  if (name === 'gemini') {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) throw new Error('GEMINI_API_KEY is required for --ai gemini');
    return new GeminiProvider(apiKey);
  }
  if (name === 'openai') {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) throw new Error('OPENAI_API_KEY is required for --ai openai');
    return new OpenAIProvider(apiKey);
  }
  throw new Error(`Unknown AI provider "${name}". Supported: claude, gemini, openai`);
}

const program = new Command();

program
  .name('seomapper')
  .description('SEO mapping and enhancement CLI for any tech stack')
  .version(version);

program
  .command('init')
  .description('Set up seomapper and save default config')
  .action(async () => {
    await runInit();
  });

program
  .command('serve')
  .description('Start seomapper as an MCP server (for Claude Desktop, Cursor, etc.)')
  .action(async () => {
    const { startMcpServer } = await import('./mcp.js');
    await startMcpServer();
  });

program
  .command('scan <url>')
  .description('Crawl a website and report SEO issues across all pages')
  .option('-d, --depth <number>', 'max pages to crawl')
  .option('-o, --output <format>', 'output format: cli, json, or html')
  .option('-f, --file <path>', 'output file path (used with --output html)')
  .option('--ignore <rules>', 'comma-separated rule IDs to skip')
  .option('--ai <provider>', 'enrich results with AI suggestions (claude, gemini, openai)')
  .option('--threshold <score>', 'exit 1 if average score is below this value (useful in CI)')
  .option('--open', 'open the HTML report in your browser after scanning')
  .action(async (rawUrl: string, options) => {
    const rc = loadRc();
    const rcDepth = rc.depth === 'auto' || rc.depth === undefined ? AUTO_DEPTH : rc.depth;
    const depth = options.depth ? parseInt(options.depth as string, 10) : rcDepth;
    const output = (options.output ?? rc.output ?? 'cli') as 'cli' | 'json' | 'html';
    const ignore: string[] = options.ignore
      ? (options.ignore as string).split(',')
      : [];

    const spinner = ora(`Resolving ${rawUrl}...`).start();

    try {
      const url = await resolveUrl(rawUrl);
      spinner.text = `Scanning ${url}...`;

      let result = await scan(url, { depth, output, ignore });

      if (options.ai) {
        spinner.text = `Enriching with ${options.ai as string} AI suggestions...`;
        const provider = createAIProvider(options.ai as string);
        result = { ...result, pages: await provider.enrich(result.pages) };
      }

      spinner.stop();

      const filePath = options.file
        ? resolve(options.file as string)
        : join(process.cwd(), 'seomapper-report.html');

      if (output === 'json') {
        if (options.open) process.stderr.write('Note: --open has no effect with --output json\n');
        reportJson(result);
      } else if (output === 'html') {
        reportHtml(result, filePath);
        if (options.open) openInBrowser(filePath);
      } else {
        reportCli(result);
        if (options.open) {
          // auto-generate an HTML report alongside the CLI output and open it
          reportHtml(result, filePath);
          openInBrowser(filePath);
        }
      }

      if (options.threshold) {
        const threshold = parseInt(options.threshold as string, 10);
        const avgScore = result.pages.length
          ? Math.round(result.pages.reduce((s, p) => s + p.score, 0) / result.pages.length)
          : 0;
        if (avgScore < threshold) {
          process.stderr.write(
            `\nThreshold not met: average score ${avgScore} < ${threshold}\n`
          );
          process.exit(1);
        }
      }
    } catch (err) {
      spinner.fail(`Failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('watch <url>')
  .description('Re-scan a URL on a timer and show what changed between runs')
  .option('-d, --depth <number>', 'max pages to crawl per run')
  .option('-i, --interval <seconds>', 'seconds between scans', '30')
  .option('--ignore <rules>', 'comma-separated rule IDs to skip')
  .action(async (rawUrl: string, options) => {
    const rc = loadRc();
    const rcDepth = rc.depth === 'auto' || rc.depth === undefined ? AUTO_DEPTH : rc.depth;
    const depth = options.depth ? parseInt(options.depth as string, 10) : rcDepth;
    const interval = parseInt(options.interval as string, 10);
    const ignore: string[] = options.ignore
      ? (options.ignore as string).split(',')
      : [];

    const spinner = ora(`Resolving ${rawUrl}...`).start();
    try {
      const url = await resolveUrl(rawUrl);
      spinner.stop();
      await runWatch(url, { depth, output: 'cli', ignore }, interval);
    } catch (err) {
      spinner.fail(`Failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parse();
