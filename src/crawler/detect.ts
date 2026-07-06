import * as cheerio from 'cheerio';
import type { SiteType } from '../types.js';

export function detectSiteType(html: string): SiteType {
  const $ = cheerio.load(html);

  // SPA signal: empty root container (React, Vue, Angular, Next.js client-only)
  const rootEl = $('#root, #app, #__next, #__nuxt');
  const hasEmptyRoot = rootEl.length > 0 && rootEl.children().length === 0;
  const bodyText = $('body').text().trim();
  const hasMinimalContent = bodyText.length < 100;

  const scripts = $('script[src]')
    .map((_, el) => $(el).attr('src') || '')
    .get();

  // Hashed bundle filenames are a strong SPA/SSR signal
  const hasBundledScripts = scripts.some(src =>
    /chunk|bundle|main\.[a-f0-9]{6,}\.js/.test(src)
  );

  if (hasEmptyRoot || (hasMinimalContent && hasBundledScripts)) {
    return 'spa';
  }

  // SSR signal: framework generator tag + rendered content + JS bundles
  const generator = $('meta[name="generator"]').attr('content') || '';
  const isSSRFramework = /next|nuxt|gatsby|astro|sveltekit/i.test(generator);
  const hasRenderedContent = bodyText.length > 100;

  if (isSSRFramework || (hasRenderedContent && hasBundledScripts)) {
    return 'ssr';
  }

  return 'static';
}
