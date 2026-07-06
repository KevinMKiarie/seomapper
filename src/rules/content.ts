import * as cheerio from 'cheerio';
import { Issue } from '../types.js';

const THIN_CONTENT_THRESHOLD = 300;

const GENERIC_ANCHOR_PATTERN =
  /^(click here|read more|here|more|learn more|this|link|page|website|download|go|continue|details)$/i;

// Matches generic auto-generated image filenames like img001.jpg, photo_3.png, DSC1234.jpg
const GENERIC_FILENAME_PATTERN =
  /\/(img_?\d*|image_?\d*|photo_?\d*|pic_?\d*|dsc\d*|screenshot[-_]?\d*)\.[a-z]{3,4}(\?|#|$)/i;

export function checkContent(html: string): Issue[] {
  const $ = cheerio.load(html);
  const issues: Issue[] = [];

  // Strip non-content nodes before counting words
  const bodyClone = $('body').clone();
  bodyClone.find('script, style, noscript, svg, code, pre').remove();
  const wordCount = bodyClone.text().split(/\s+/).filter(w => w.length > 1).length;

  if (wordCount < THIN_CONTENT_THRESHOLD) {
    issues.push({
      rule: 'thin-content',
      severity: 'warning',
      message: `Page body has only ${wordCount} words — likely too thin for AEO eligibility`,
      fix: 'Add substantive, original content. Google AEO rewards pages with unique expert insights over 300+ words.',
    });
  }

  // AEO: AI agents follow links to understand context — generic text breaks that signal
  let genericAnchorCount = 0;
  $('a[href]').each((_, el) => {
    const text = $(el).text().trim();
    if (GENERIC_ANCHOR_PATTERN.test(text)) genericAnchorCount++;
  });
  if (genericAnchorCount > 0) {
    issues.push({
      rule: 'generic-anchor-text',
      severity: 'warning',
      message: `${genericAnchorCount} link(s) use generic anchor text like "click here" or "read more"`,
      fix: 'Use descriptive link text that signals the destination, e.g. "View our pricing plans" instead of "click here"',
    });
  }

  // AEO guide: "DOM structure and accessibility tree clarity" — semantic landmarks are the scaffold
  const hasMain = $('main').length > 0;
  const hasNav = $('nav').length > 0;
  if (!hasMain || !hasNav) {
    const missing = [!hasMain && '<main>', !hasNav && '<nav>'].filter(Boolean).join(' and ');
    issues.push({
      rule: 'semantic-html-missing',
      severity: 'info',
      message: `Page is missing semantic HTML landmark(s): ${missing}`,
      fix: 'Wrap your primary content in <main> and navigation in <nav> so AI agents can map your page structure',
    });
  }

  // Generic filenames carry no keyword signal for image search or AI context
  let genericImgCount = 0;
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src') ?? '';
    if (GENERIC_FILENAME_PATTERN.test(src)) genericImgCount++;
  });
  if (genericImgCount > 0) {
    issues.push({
      rule: 'image-filename-generic',
      severity: 'info',
      message: `${genericImgCount} image(s) have non-descriptive filenames (e.g. img001.jpg)`,
      fix: 'Rename images to describe the subject, e.g. blue-running-shoes.jpg — this feeds image search and AI alt-text inference',
    });
  }

  // Google's freshness algorithm rewards recently updated content.
  // Article/blog pages with no date signal look stale to both crawlers and AI.
  const isContentPage =
    $('article').length > 0 ||
    $('[class*="post"],[class*="blog"],[class*="article"]').length > 0;
  const hasDateSignal =
    $('time[datetime]').length > 0 ||
    !!$('meta[property="article:published_time"]').attr('content') ||
    !!$('meta[name="date"]').attr('content') ||
    !!$('meta[property="article:modified_time"]').attr('content');
  if (isContentPage && !hasDateSignal) {
    issues.push({
      rule: 'content-freshness-missing',
      severity: 'info',
      message: 'Article content detected but no publication date signal found',
      fix: 'Add <time datetime="YYYY-MM-DD"> or <meta property="article:published_time"> so Google can evaluate content freshness',
    });
  }

  return issues;
}
