import * as cheerio from 'cheerio';
import { fetchStatic, extractLinks } from './crawler/static.js';
import { fetchWithBrowser } from './crawler/browser.js';
import { runRules } from './rules/index.js';
import { checkDuplicates } from './rules/cross-page.js';
import { calculateScore } from './scoring.js';
import { ScanConfig, ScanResult, PageResult } from './types.js';

export async function scan(startUrl: string, config: ScanConfig): Promise<ScanResult> {
  const visited = new Set<string>();
  const queue: string[] = [startUrl];
  const pages: PageResult[] = [];
  const baseUrl = new URL(startUrl).origin;

  // Collect title+description per page for the cross-page duplicate check
  const pageMeta: Array<{ url: string; title: string; description: string }> = [];

  while (queue.length > 0 && pages.length < config.depth) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    // Lightweight fetch first to detect site type
    const staticPage = await fetchStatic(url);

    // Re-fetch with a real browser if JavaScript rendering is required
    const page =
      staticPage.type === 'spa'
        ? await fetchWithBrowser(url)
        : staticPage;

    const isFirstPage = pages.length === 0;
    const issues = await runRules(page, baseUrl, isFirstPage, config.ignore);

    const $ = cheerio.load(page.html);
    pageMeta.push({
      url,
      title: $('title').first().text().trim(),
      description: $('meta[name="description"]').attr('content')?.trim() ?? '',
    });

    pages.push({
      url,
      type: page.type,
      issues,
      score: calculateScore(issues),
    });

    // Queue discovered internal links for next iterations
    for (const link of extractLinks(page.html, url)) {
      if (!visited.has(link)) queue.push(link);
    }

    // Polite crawl delay — avoids hammering the target server
    if (queue.length > 0 && pages.length < config.depth) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // Cross-page checks run after the full crawl so we can compare across pages
  if (pages.length > 1) {
    const duplicateIssues = checkDuplicates(pageMeta);
    for (const page of pages) {
      const extra = duplicateIssues.get(page.url);
      if (extra && extra.length > 0) {
        const filtered = extra.filter(i => !config.ignore.includes(i.rule));
        page.issues.push(...filtered);
        page.score = calculateScore(page.issues);
      }
    }
  }

  return {
    startUrl,
    pagesScanned: pages.length,
    totalIssues: pages.reduce((sum, p) => sum + p.issues.length, 0),
    pages,
    scannedAt: new Date().toISOString(),
  };
}
