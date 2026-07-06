import type { Issue, ScanResult } from './types.js';

// Point cost per rule, based on real-world ranking impact.
// Higher = bigger penalty when the rule fires.
// Anything not listed falls back to the severity default at the bottom.
const RULE_WEIGHTS: Record<string, number> = {
  // Crawlability and indexability — Google can't rank what it can't read
  'noindex-detected':  20,
  'robots-txt-missing': 15,
  'http-not-https':     15,

  // Core on-page signals — highest correlation with ranking position
  'title-missing':      20,
  'description-missing': 14,
  'h1-missing':         12,
  'canonical-missing':  10,
  'viewport-missing':   12,

  // Content quality signals
  'title-too-short':     5,
  'title-too-long':      5,
  'description-too-short': 4,
  'description-too-long':  4,
  'multiple-h1':         8,
  'heading-skip':        4,
  'image-alt-missing':   8,

  // Discoverability
  'sitemap-missing':     8,

  // Social / open graph — affects CTR in social previews
  'og-title-missing':       4,
  'og-description-missing': 4,
  'og-image-missing':       3,

  // Structured data — boosts rich results and AI Overview eligibility
  'schema-missing':      5,
  'schema-invalid-json': 6,
  'schema-no-context':   4,
  'schema-no-type':      4,
  'faq-schema-missing':  4,
  'article-schema-missing': 4,

  // Security headers — minor ranking signal, big trust signal
  'hsts-missing':                    5,
  'x-content-type-missing':          3,
  'clickjacking-protection-missing': 3,

  // AI Search / E-E-A-T — increasingly important, not yet hard ranking factors
  'eeat-author-missing':          3,
  'breadcrumb-schema-missing':    2,
  'organization-schema-missing':  2,

  // AEO-specific — from Google's AI optimization guide
  'html-lang-missing':    10,
  'thin-content':         10,
  'duplicate-title':      14,
  'duplicate-description': 8,
  'speakable-missing':     3,
  'video-schema-missing':  6,
  'product-schema-missing': 7,

  // Content quality
  'generic-anchor-text':     5,
  'semantic-html-missing':   4,
  'image-filename-generic':  2,

  // Extended Open Graph + social
  'og-type-missing':      3,
  'og-url-missing':       2,
  'twitter-card-missing': 2,
  'favicon-missing':      2,

  // Technical hygiene (from Google Search docs + Wikipedia)
  'meta-refresh':    12, // Google explicitly recommends against it
  'mixed-content':    8, // browsers block it; suppresses HTTPS padlock
  'nofollow-internal': 6, // leaks PageRank inside your own site
  'hreflang-missing':  6, // wrong language version served to wrong audience
  'content-freshness-missing': 3,

  // Informational — no score impact
  'page-truncated': 0,
};

const SEVERITY_FALLBACK: Record<string, number> = {
  error:   10,
  warning:  4,
  info:     1,
};

export function ruleWeight(issue: Issue): number {
  return RULE_WEIGHTS[issue.rule] ?? SEVERITY_FALLBACK[issue.severity] ?? 4;
}

export function calculateScore(issues: Issue[]): number {
  const penalty = issues.reduce((sum, i) => sum + ruleWeight(i), 0);
  return Math.max(0, 100 - penalty);
}

export interface QuickWin {
  rule: string;
  message: string;
  pagesAffected: number;
  pointsPerPage: number;
  totalGain: number;
}

export function quickWins(result: ScanResult, topN = 5): QuickWin[] {
  const byRule = new Map<string, { message: string; weight: number; pages: number }>();

  for (const page of result.pages) {
    for (const issue of page.issues) {
      const w = ruleWeight(issue);
      if (w === 0) continue;
      const existing = byRule.get(issue.rule);
      if (existing) {
        existing.pages += 1;
      } else {
        byRule.set(issue.rule, { message: issue.message, weight: w, pages: 1 });
      }
    }
  }

  return [...byRule.entries()]
    .map(([rule, { message, weight, pages }]) => ({
      rule,
      message,
      pagesAffected: pages,
      pointsPerPage: weight,
      totalGain: weight * pages,
    }))
    .sort((a, b) => b.totalGain - a.totalGain)
    .slice(0, topN);
}
