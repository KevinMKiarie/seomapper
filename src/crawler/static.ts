import * as cheerio from 'cheerio';
import { detectSiteType } from './detect.js';
import { assertPublicUrl } from '../utils/ssrf.js';
import type { ParsedPage } from '../types.js';

const UA = 'seomapper/0.1 (https://github.com/KevinMKiarie/seomapper)';

// Refuse to touch anything absurdly large before we even start streaming
const HARD_REJECT_BYTES = 50 * 1024 * 1024; // 50 MB

// Stop reading once we have the full <head> + this much body content
const HEAD_SCAN_LIMIT = 500 * 1024;  // 500 KB cap if </head> never appears
const BODY_EXTRA     = 200 * 1024;   // 200 KB past </head> captures early body / JSON-LD in body

async function fetchWithTimeout(url: string, ms: number, method = 'GET'): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      method,
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function streamHtml(response: Response): Promise<{ html: string; truncated: boolean }> {
  // No body (e.g. cached 304) — fall back to text()
  if (!response.body) {
    return { html: await response.text(), truncated: false };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let totalBytes = 0;
  let truncated = false;
  let headClosed = false;
  let bytesAfterHead = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      const chunk = decoder.decode(value, { stream: true });
      parts.push(chunk);

      if (!headClosed) {
        // Scan a small window around the chunk boundary to catch </head> spanning two chunks
        const window = parts.length > 1 ? parts[parts.length - 2].slice(-10) + chunk : chunk;
        if (window.toLowerCase().includes('</head>')) {
          headClosed = true;
        } else if (totalBytes >= HEAD_SCAN_LIMIT) {
          // Never found </head> and hit the hard cap — truncate here
          truncated = true;
          break;
        }
      } else {
        bytesAfterHead += value.byteLength;
        if (bytesAfterHead >= BODY_EXTRA) {
          truncated = true;
          break;
        }
      }
    }
  } finally {
    // Always release the network connection even if we stopped early
    reader.cancel().catch(() => {});
  }

  parts.push(decoder.decode()); // flush remaining bytes in TextDecoder
  return { html: parts.join(''), truncated };
}

export async function fetchStatic(url: string): Promise<ParsedPage> {
  await assertPublicUrl(url);
  const response = await fetchWithTimeout(url, 10000);

  // Hard reject before streaming — Content-Length is a hint, not a guarantee
  const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10);
  if (contentLength > HARD_REJECT_BYTES) {
    throw new Error(
      `Response too large (${(contentLength / 1024 / 1024).toFixed(0)} MB). Refusing pages over 50 MB.`
    );
  }

  const { html, truncated } = await streamHtml(response);
  const type = detectSiteType(html);
  return { url, html, type, truncated };
}

export async function headRequest(url: string, ms: number): Promise<void> {
  await fetchWithTimeout(url, ms, 'HEAD');
}

export function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const links: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const resolved = new URL(href, baseUrl);
      if (
        resolved.hostname === base.hostname &&
        (resolved.protocol === 'http:' || resolved.protocol === 'https:')
      ) {
        links.push(resolved.href.split('#')[0]);
      }
    } catch {
      // malformed href — skip
    }
  });

  return [...new Set(links)];
}
