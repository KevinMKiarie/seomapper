import * as cheerio from 'cheerio';
import type { Issue } from '../types.js';

export function checkMeta(html: string): Issue[] {
  const $ = cheerio.load(html);
  const issues: Issue[] = [];

  const title = $('title').first().text().trim();
  if (!title) {
    issues.push({
      rule: 'title-missing',
      severity: 'error',
      message: 'Page has no <title> tag',
      fix: 'Add a descriptive <title> inside <head>',
    });
  } else if (title.length < 30) {
    issues.push({
      rule: 'title-too-short',
      severity: 'warning',
      message: `Title is ${title.length} chars — recommended 30–60`,
      fix: 'Expand the title to at least 30 characters',
    });
  } else if (title.length > 60) {
    issues.push({
      rule: 'title-too-long',
      severity: 'warning',
      message: `Title is ${title.length} chars — recommended 30–60`,
      fix: 'Shorten the title to under 60 characters to avoid SERP truncation',
    });
  }

  const description = $('meta[name="description"]').attr('content')?.trim() ?? '';
  if (!description) {
    issues.push({
      rule: 'description-missing',
      severity: 'error',
      message: 'Page has no meta description',
      fix: 'Add <meta name="description" content="..."> inside <head>',
    });
  } else if (description.length < 120) {
    issues.push({
      rule: 'description-too-short',
      severity: 'warning',
      message: `Meta description is ${description.length} chars — recommended 120–160`,
      fix: 'Expand the meta description to at least 120 characters',
    });
  } else if (description.length > 160) {
    issues.push({
      rule: 'description-too-long',
      severity: 'warning',
      message: `Meta description is ${description.length} chars — recommended 120–160`,
      fix: 'Shorten to under 160 characters to avoid truncation in SERPs',
    });
  }

  if (!$('meta[property="og:title"]').attr('content')) {
    issues.push({
      rule: 'og-title-missing',
      severity: 'warning',
      message: 'Missing og:title meta tag',
      fix: 'Add <meta property="og:title" content="..."> for social sharing previews',
    });
  }

  if (!$('meta[property="og:description"]').attr('content')) {
    issues.push({
      rule: 'og-description-missing',
      severity: 'warning',
      message: 'Missing og:description meta tag',
      fix: 'Add <meta property="og:description" content="...">',
    });
  }

  if (!$('meta[property="og:image"]').attr('content')) {
    issues.push({
      rule: 'og-image-missing',
      severity: 'warning',
      message: 'Missing og:image meta tag',
      fix: 'Add <meta property="og:image" content="https://..."> for link preview images',
    });
  }

  if (!$('meta[name="viewport"]').attr('content')) {
    issues.push({
      rule: 'viewport-missing',
      severity: 'error',
      message: 'Missing viewport meta tag — mobile rendering will break',
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
    });
  }

  // AEO: AI agents parse the accessibility tree — lang is the first signal they read
  if (!$('html').attr('lang')) {
    issues.push({
      rule: 'html-lang-missing',
      severity: 'error',
      message: 'Missing lang attribute on <html> element',
      fix: 'Add lang="en" (or your page\'s language code) to the opening <html> tag',
    });
  }

  if (!$('meta[property="og:type"]').attr('content')) {
    issues.push({
      rule: 'og-type-missing',
      severity: 'info',
      message: 'Missing og:type meta tag',
      fix: 'Add <meta property="og:type" content="website"> (or article, product, etc.)',
    });
  }

  if (!$('meta[property="og:url"]').attr('content')) {
    issues.push({
      rule: 'og-url-missing',
      severity: 'info',
      message: 'Missing og:url meta tag',
      fix: 'Add <meta property="og:url" content="https://yourdomain.com/page"> to anchor social sharing to the canonical URL',
    });
  }

  if (!$('meta[name="twitter:card"]').attr('content')) {
    issues.push({
      rule: 'twitter-card-missing',
      severity: 'info',
      message: 'Missing twitter:card meta tag',
      fix: 'Add <meta name="twitter:card" content="summary_large_image"> for rich Twitter/X previews',
    });
  }

  const hasFavicon =
    $('link[rel="icon"]').length > 0 ||
    $('link[rel="shortcut icon"]').length > 0 ||
    $('link[rel="apple-touch-icon"]').length > 0;

  if (!hasFavicon) {
    issues.push({
      rule: 'favicon-missing',
      severity: 'info',
      message: 'No favicon declared in <head>',
      fix: 'Add <link rel="icon" href="/favicon.ico"> to display a brand icon in browser tabs and SERPs',
    });
  }

  return issues;
}
