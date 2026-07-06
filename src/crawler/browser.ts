import { chromium } from 'playwright';
import { ParsedPage } from '../types.js';

const HEAD_SCAN_LIMIT = 500 * 1024;
const BODY_EXTRA = 200 * 1024;

function truncateHtml(html: string): { html: string; truncated: boolean } {
  const bytes = Buffer.byteLength(html);
  const headClose = html.toLowerCase().indexOf('</head>');

  if (headClose !== -1) {
    const headBytes = Buffer.byteLength(html.slice(0, headClose + 7));
    const maxBytes = headBytes + BODY_EXTRA;
    if (bytes <= maxBytes) return { html, truncated: false };
    const truncated = Buffer.from(html).slice(0, maxBytes).toString('utf8').replace(/�+$/, '');
    return { html: truncated, truncated: true };
  }

  if (bytes <= HEAD_SCAN_LIMIT) return { html, truncated: false };
  const truncated = Buffer.from(html).slice(0, HEAD_SCAN_LIMIT).toString('utf8').replace(/�+$/, '');
  return { html: truncated, truncated: true };
}

// Used for SPAs that need JavaScript execution to render content
export async function fetchWithBrowser(url: string): Promise<ParsedPage> {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    const rawHtml = await page.content();
    const { html, truncated } = truncateHtml(rawHtml);

    return { url, html, type: 'spa', truncated };
  } finally {
    await browser.close();
  }
}
