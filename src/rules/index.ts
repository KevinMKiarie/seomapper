import { Issue, ParsedPage } from '../types.js';
import { checkMeta } from './meta.js';
import { checkStructure, checkLinks, checkRobotsTxt, checkSitemap } from './structure.js';
import { checkSchema } from './schema.js';
import { checkAiSearch } from './ai-search.js';
import { checkContent } from './content.js';
import { checkHttpsSecurity, checkSecurityHeaders } from './security.js';

export async function runRules(
  page: ParsedPage,
  baseUrl: string,
  isFirstPage: boolean,
  ignore: string[]
): Promise<Issue[]> {
  const issues: Issue[] = [
    ...checkMeta(page.html),
    ...checkStructure(page.html),
    ...checkLinks(page.html, page.url),
    ...checkSchema(page.html),
    ...checkAiSearch(page.html),
    ...checkContent(page.html),
    ...checkHttpsSecurity(page.url, page.html),
  ];

  if (page.truncated) {
    issues.unshift({
      rule: 'page-truncated',
      severity: 'warning',
      message:
        'Page HTML was too large and was truncated during scanning. All <head> signals were fully captured; body content beyond the first 200 KB may be incomplete.',
      fix: 'No action required. SEO-critical metadata lives in <head> and was fully scanned.',
    });
  }

  // Site-level checks only run once — they test the root domain, not per-page HTML
  if (isFirstPage) {
    const [robotsIssues, sitemapIssues, securityHeaderIssues] = await Promise.all([
      checkRobotsTxt(baseUrl),
      checkSitemap(baseUrl),
      checkSecurityHeaders(baseUrl),
    ]);
    issues.push(...robotsIssues, ...sitemapIssues, ...securityHeaderIssues);
  }

  return issues.filter(issue => !ignore.includes(issue.rule));
}
