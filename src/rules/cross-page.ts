import type { Issue } from '../types.js';

export interface PageMeta {
  url: string;
  title: string;
  description: string;
}

// Returns a map of url → additional issues discovered by comparing across all pages.
// Run once after the full crawl, not per-page.
export function checkDuplicates(pages: PageMeta[]): Map<string, Issue[]> {
  const result = new Map<string, Issue[]>();
  const titleMap = new Map<string, string[]>();
  const descMap  = new Map<string, string[]>();

  for (const { url, title, description } of pages) {
    if (title) {
      const urls = titleMap.get(title) ?? [];
      urls.push(url);
      titleMap.set(title, urls);
    }
    if (description) {
      const urls = descMap.get(description) ?? [];
      urls.push(url);
      descMap.set(description, urls);
    }
  }

  for (const { url, title, description } of pages) {
    const issues: Issue[] = [];

    const titleUrls = titleMap.get(title);
    if (title && titleUrls && titleUrls.length > 1) {
      const others = titleUrls.filter(u => u !== url).join(', ');
      issues.push({
        rule: 'duplicate-title',
        severity: 'error',
        message: `Title "${title.slice(0, 60)}" is shared with: ${others}`,
        fix: 'Each page needs a unique <title> tag — duplicate titles confuse both users and search engines',
      });
    }

    const descUrls = descMap.get(description);
    if (description && descUrls && descUrls.length > 1) {
      const others = descUrls.filter(u => u !== url).join(', ');
      issues.push({
        rule: 'duplicate-description',
        severity: 'warning',
        message: `Meta description is shared with: ${others}`,
        fix: 'Write a unique meta description for each page that summarises its specific content',
      });
    }

    if (issues.length > 0) result.set(url, issues);
  }

  return result;
}
