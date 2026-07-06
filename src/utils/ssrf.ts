import { lookup } from 'dns/promises';

// Private IP ranges that should never be reachable from a public SEO scanner
const BLOCKED = [
  /^127\./,                                              // loopback
  /^10\./,                                               // RFC 1918 class A
  /^192\.168\./,                                         // RFC 1918 class C
  /^172\.(1[6-9]|2\d|3[01])\./,                         // RFC 1918 class B
  /^169\.254\./,                                         // link-local (APIPA)
  /^100\.6[4-9]\.|^100\.[7-9]\d\.|^100\.1[0-1]\d\.|^100\.12[0-7]\./, // RFC 6598
  /^::1$/,                                               // IPv6 loopback
  /^fc[0-9a-f]{2}:/i,                                   // IPv6 unique-local
  /^fe80:/i,                                             // IPv6 link-local
];

function isPrivateIp(ip: string): boolean {
  return BLOCKED.some(r => r.test(ip));
}

export async function assertPublicUrl(url: string): Promise<void> {
  const { hostname } = new URL(url);

  if (hostname === 'localhost' || hostname === '0.0.0.0') {
    throw new Error(`Blocked: scanning ${hostname} is not allowed`);
  }

  try {
    const { address } = await lookup(hostname);
    if (isPrivateIp(address)) {
      throw new Error(`Blocked: ${hostname} resolves to private address ${address}`);
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // DNS not found or timeout is fine — let the fetch fail naturally
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return;
    throw err;
  }
}
