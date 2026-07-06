import type { ScanResult } from '../types.js';

export function reportJson(result: ScanResult): void {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
