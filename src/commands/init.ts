import {
  intro,
  outro,
  text,
  select,
  confirm,
  note,
  cancel,
  isCancel,
} from '@clack/prompts';
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8')
) as { version: string };

interface SeoMapperConfig {
  depth: number | 'auto';
  output: 'cli' | 'json' | 'html';
}

export async function runInit(): Promise<void> {
  console.log();
  intro(`${chalk.bold('seomapper')} ${chalk.dim(`v${version}`)}`);

  note(
    [
      'Scans your website and reports SEO issues across all pages.',
      '',
      `${chalk.bold('Checks:')}`,
      `  ${chalk.cyan('◆')} ${chalk.white('Meta tags')}   ${chalk.dim('—')} title, description, Open Graph`,
      `  ${chalk.cyan('◆')} ${chalk.white('Structure')}   ${chalk.dim('—')} H1, headings, alt text, canonical URLs`,
      `  ${chalk.cyan('◆')} ${chalk.white('JSON-LD')}     ${chalk.dim('—')} Schema.org structured data`,
      `  ${chalk.cyan('◆')} ${chalk.white('AI Search')}   ${chalk.dim('—')} FAQPage, Article, E-E-A-T, Breadcrumbs`,
      `  ${chalk.cyan('◆')} ${chalk.white('Site files')}  ${chalk.dim('—')} robots.txt, sitemap.xml`,
    ].join('\n'),
    'What seomapper does'
  );

  const depthMode = await select({
    message: 'How many pages should seomapper scan by default?',
    options: [
      {
        value: 'auto' as const,
        label: 'Auto',
        hint: 'seomapper decides — crawls up to 100 pages or until none remain',
      },
      {
        value: 'manual' as const,
        label: 'Manual',
        hint: 'I\'ll specify an exact number',
      },
    ],
  });

  if (isCancel(depthMode)) {
    cancel('Setup cancelled.');
    process.exit(0);
  }

  let depthValue: number | 'auto' = 'auto';

  if (depthMode === 'manual') {
    const manualInput = await text({
      message: 'How many pages to scan per run?',
      placeholder: '20',
      validate(value) {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 1) return 'Please enter a number greater than 0';
      },
    });

    if (isCancel(manualInput)) {
      cancel('Setup cancelled.');
      process.exit(0);
    }

    depthValue = parseInt(manualInput as string, 10);
  }

  const output = await select({
    message: 'Default output format?',
    options: [
      {
        value: 'cli' as const,
        label: 'CLI',
        hint: 'colored table printed in the terminal',
      },
      {
        value: 'html' as const,
        label: 'HTML',
        hint: 'self-contained report file, opens in any browser',
      },
      {
        value: 'json' as const,
        label: 'JSON',
        hint: 'machine-readable, pipe to a file or CI pipeline',
      },
    ],
  });

  if (isCancel(output)) {
    cancel('Setup cancelled.');
    process.exit(0);
  }

  const save = await confirm({
    message: 'Save these defaults to .seomapperrc.json?',
    initialValue: true,
  });

  if (isCancel(save)) {
    cancel('Setup cancelled.');
    process.exit(0);
  }

  if (save) {
    const config: SeoMapperConfig = {
      depth: depthValue,
      output: output as 'cli' | 'json' | 'html',
    };
    writeFileSync('.seomapperrc.json', JSON.stringify(config, null, 2) + '\n');
  }

  note(
    [
      `${chalk.dim('$')} ${chalk.cyan('seomapper scan yoursite.com')}`,
      `${chalk.dim('$')} ${chalk.cyan('seomapper scan yoursite.com --depth 20')}`,
      `${chalk.dim('$')} ${chalk.cyan('seomapper scan yoursite.com --output html --open')}`,
      `${chalk.dim('$')} ${chalk.cyan('seomapper scan yoursite.com --output json > report.json')}`,
      `${chalk.dim('$')} ${chalk.cyan('seomapper scan yoursite.com --ai claude')}`,
      `${chalk.dim('$')} ${chalk.cyan('seomapper watch yoursite.com --interval 30')}`,
    ].join('\n'),
    'Quick start'
  );

  outro(chalk.green('All set! Run seomapper scan <url> to get started.'));
}
