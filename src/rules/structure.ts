import * as cheerio from 'cheerio';
import { headRequest } from '../crawler/static.js';
import type { Issue } from '../types.js';

export function checkStructure(html: string): Issue[] {
  const $ = cheerio.load(html);
  const issues: Issue[] = [];

  const h1Count = $('h1').length;
  if (h1Count === 0) {
    issues.push({
      rule: 'h1-missing',
      severity: 'error',
      message: 'Page has no H1 heading',
      fix: 'Add a single <h1> that describes the page\'s main topic',
    });
  } else if (h1Count > 1) {
    issues.push({
      rule: 'multiple-h1',
      severity: 'warning',
      message: `Page has ${h1Count} H1 headings — should have exactly one`,
      fix: 'Keep one <h1>; demote the rest to <h2>',
    });
  }

  const levels = $('h1,h2,h3,h4,h5,h6')
    .map((_, el) => parseInt(el.tagName[1], 10))
    .get();

  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      issues.push({
        rule: 'heading-skip',
        severity: 'warning',
        message: `Heading level jumped from H${levels[i - 1]} to H${levels[i]}`,
        fix: `Use H${levels[i - 1] + 1} instead of H${levels[i]} to maintain hierarchy`,
      });
      break; // one report is enough
    }
  }

  const missingAlt = $('img:not([alt])').length;
  if (missingAlt > 0) {
    issues.push({
      rule: 'image-alt-missing',
      severity: 'error',
      message: `${missingAlt} image(s) are missing alt attributes`,
      fix: 'Add descriptive alt text to every <img> tag',
    });
  }

  if (!$('link[rel="canonical"]').attr('href')) {
    issues.push({
      rule: 'canonical-missing',
      severity: 'warning',
      message: 'No canonical URL defined',
      fix: 'Add <link rel="canonical" href="https://..."> to prevent duplicate content penalties',
    });
  }

  const robotsMeta = $('meta[name="robots"]').attr('content') ?? '';
  if (/noindex/i.test(robotsMeta)) {
    issues.push({
      rule: 'noindex-detected',
      severity: 'error',
      message: 'Page is set to noindex — search engines will skip it',
      fix: 'Remove noindex from the robots meta tag if this page should be indexed',
    });
  }

  // Google explicitly recommends 301 redirects over meta refresh — it delays indexing
  // and can be treated as a doorway page
  if ($('meta[http-equiv="refresh"]').length > 0) {
    issues.push({
      rule: 'meta-refresh',
      severity: 'error',
      message: 'Page uses <meta http-equiv="refresh"> for redirection',
      fix: 'Replace with a server-side 301 redirect — meta-refresh delays indexing and can be flagged as a doorway page',
    });
  }

  return issues;
}

export function checkLinks(html: string, pageUrl: string): Issue[] {
  const $ = cheerio.load(html);
  const issues: Issue[] = [];

  let hostname: string;
  try {
    hostname = new URL(pageUrl).hostname;
  } catch {
    return issues;
  }

  // nofollow on internal links stops PageRank from flowing through your own site
  let nofollowInternalCount = 0;
  $('a[href][rel]').each((_, el) => {
    const rel = $(el).attr('rel') ?? '';
    if (!/nofollow/i.test(rel)) return;
    const href = $(el).attr('href') ?? '';
    try {
      const linked = new URL(href, pageUrl);
      if (linked.hostname === hostname) nofollowInternalCount++;
    } catch {
      // malformed href
    }
  });

  if (nofollowInternalCount > 0) {
    issues.push({
      rule: 'nofollow-internal',
      severity: 'warning',
      message: `${nofollowInternalCount} internal link(s) carry rel="nofollow", blocking PageRank from flowing to those pages`,
      fix: 'Remove nofollow from internal links — it should only be used on external, sponsored, or user-generated links',
    });
  }

  // Multilingual URL pattern without hreflang means Google will guess which version to serve
  const langInPath = /\/(en|fr|de|es|pt|it|nl|pl|ru|ja|ko|zh|ar|sv|da|fi|nb|tr)(\/|$)/i;
  const hasHreflang = $('link[rel="alternate"][hreflang]').length > 0;
  if (langInPath.test(pageUrl) && !hasHreflang) {
    issues.push({
      rule: 'hreflang-missing',
      severity: 'warning',
      message: 'URL suggests a language-specific page but no hreflang alternate links are declared',
      fix: 'Add <link rel="alternate" hreflang="xx" href="..."> for each language version so Google serves the right variant to the right audience',
    });
  }

  return issues;
}

// Checked once per scan, not per page
export async function checkRobotsTxt(baseUrl: string): Promise<Issue[]> {
  const url = new URL('/robots.txt', baseUrl).href;
  try {
    await headRequest(url, 5000);
    return [];
  } catch {
    return [{
      rule: 'robots-txt-missing',
      severity: 'warning',
      message: `No robots.txt found at ${url}`,
      fix: 'Create a robots.txt at your domain root to guide crawler access',
    }];
  }
}

export async function checkSitemap(baseUrl: string): Promise<Issue[]> {
  const url = new URL('/sitemap.xml', baseUrl).href;
  try {
    await headRequest(url, 5000);
    return [];
  } catch {
    return [{
      rule: 'sitemap-missing',
      severity: 'warning',
      message: `No sitemap.xml found at ${url}`,
      fix: 'Generate a sitemap.xml and submit it to Google Search Console',
    }];
  }
}
