import * as cheerio from 'cheerio';
import { Issue } from '../types.js';

const MAX_RESPONSE_MS = 5000;

export function checkHttpsSecurity(url: string, html?: string): Issue[] {
  const issues: Issue[] = [];

  if (url.startsWith('http://')) {
    issues.push({
      rule: 'http-not-https',
      severity: 'error',
      message: 'Page is served over HTTP — Google penalises non-HTTPS sites',
      fix: 'Set up an SSL certificate and redirect all HTTP traffic to HTTPS',
    });
    return issues; // mixed-content check is irrelevant if the page itself is HTTP
  }

  // HTTPS page loading HTTP resources — browsers block these and it signals a trust issue
  if (html) {
    const $ = cheerio.load(html);
    const httpResources =
      $('script[src^="http://"]').length +
      $('img[src^="http://"]').length +
      $('iframe[src^="http://"]').length +
      $('link[rel="stylesheet"][href^="http://"]').length;
    if (httpResources > 0) {
      issues.push({
        rule: 'mixed-content',
        severity: 'warning',
        message: `${httpResources} resource(s) are loaded over HTTP on an HTTPS page`,
        fix: 'Update all resource URLs to HTTPS — browsers block mixed content and it can suppress the padlock icon',
      });
    }
  }

  return issues;
}

export async function checkSecurityHeaders(url: string): Promise<Issue[]> {
  const issues: Issue[] = [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MAX_RESPONSE_MS);
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);

    const h = response.headers;

    if (url.startsWith('https://') && !h.get('strict-transport-security')) {
      issues.push({
        rule: 'hsts-missing',
        severity: 'warning',
        message: 'Missing Strict-Transport-Security (HSTS) header',
        fix: 'Add: Strict-Transport-Security: max-age=31536000; includeSubDomains',
      });
    }

    if (!h.get('x-content-type-options')) {
      issues.push({
        rule: 'x-content-type-missing',
        severity: 'info',
        message: 'Missing X-Content-Type-Options header',
        fix: 'Add: X-Content-Type-Options: nosniff',
      });
    }

    if (!h.get('x-frame-options') && !h.get('content-security-policy')?.includes('frame-ancestors')) {
      issues.push({
        rule: 'clickjacking-protection-missing',
        severity: 'info',
        message: 'No clickjacking protection (X-Frame-Options or CSP frame-ancestors)',
        fix: 'Add: X-Frame-Options: SAMEORIGIN',
      });
    }
  } catch {
    // server unavailable or timeout — skip header checks silently
  }

  return issues;
}
