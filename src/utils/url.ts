import { headRequest } from '../crawler/static.js';

export async function resolveUrl(input: string): Promise<string> {
  const url = addProtocol(input.trim().replace(/\/+$/, ''));
  const candidates = buildCandidates(url);

  for (const candidate of candidates) {
    try {
      // Treat any HTTP response (including 4xx/5xx) as reachable — only network errors skip
      await headRequest(candidate, 5000);
      return candidate;
    } catch {
      // DNS failure, timeout, refused — try next variant
    }
  }

  return candidates[0];
}

function addProtocol(input: string): string {
  return /^https?:\/\//i.test(input) ? input : `https://${input}`;
}

function buildCandidates(url: string): string[] {
  const { hostname, pathname, search } = new URL(url);
  const path = pathname + search;
  const hasWww = hostname.startsWith('www.');
  const altHost = hasWww ? hostname.slice(4) : `www.${hostname}`;

  // User's exact hostname first, then www/bare alternative, then http fallbacks
  return [
    `https://${hostname}${path}`,
    `https://${altHost}${path}`,
    `http://${hostname}${path}`,
    `http://${altHost}${path}`,
  ];
}
