import * as cheerio from 'cheerio';
import { Issue } from '../types.js';

interface JsonLd {
  '@context'?: string;
  '@type'?: string;
  [key: string]: unknown;
}

function extractJsonLd(html: string): JsonLd[] {
  const $ = cheerio.load(html);
  const results: JsonLd[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() ?? '') as JsonLd | JsonLd[];
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else {
        results.push(parsed);
      }
    } catch {
      // handled below as a separate error issue
    }
  });

  return results;
}

export function checkSchema(html: string): Issue[] {
  const $ = cheerio.load(html);
  const issues: Issue[] = [];
  const scripts = $('script[type="application/ld+json"]');

  if (scripts.length === 0) {
    issues.push({
      rule: 'schema-missing',
      severity: 'warning',
      message: 'No JSON-LD structured data found on this page',
      fix: 'Add Schema.org JSON-LD markup so search engines can understand your content',
    });
    return issues;
  }

  scripts.each((_, el) => {
    const raw = $(el).html() ?? '';

    let parsed: JsonLd | JsonLd[];
    try {
      parsed = JSON.parse(raw) as JsonLd | JsonLd[];
    } catch {
      issues.push({
        rule: 'schema-invalid-json',
        severity: 'error',
        message: 'A <script type="application/ld+json"> block contains invalid JSON',
        fix: 'Validate your structured data at https://validator.schema.org',
      });
      return;
    }

    const blocks: JsonLd[] = Array.isArray(parsed) ? parsed : [parsed];
    for (const block of blocks) {
      if (!block['@context']) {
        issues.push({
          rule: 'schema-no-context',
          severity: 'error',
          message: 'JSON-LD block is missing @context',
          fix: 'Add "@context": "https://schema.org" to your JSON-LD object',
        });
      }
      if (!block['@type']) {
        issues.push({
          rule: 'schema-no-type',
          severity: 'error',
          message: 'JSON-LD block is missing @type',
          fix: 'Specify a Schema.org type e.g. "@type": "WebPage" or "@type": "Article"',
        });
      }
    }
  });

  return issues;
}

// Exported so ai-search.ts can re-use without double-parsing
export { extractJsonLd };
