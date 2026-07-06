export type Severity = 'error' | 'warning' | 'info';
export type SiteType = 'static' | 'ssr' | 'spa';

export interface AISuggestion {
  explanation: string;
  codefix: string | null;
}

export interface Issue {
  rule: string;
  severity: Severity;
  message: string;
  fix: string;
  aiSuggestion?: AISuggestion;
}

export interface PageResult {
  url: string;
  type: SiteType;
  issues: Issue[];
  score: number;
}

export interface ScanConfig {
  depth: number;
  output: 'cli' | 'json' | 'html';
  ignore: string[];
}

export interface ScanResult {
  startUrl: string;
  pagesScanned: number;
  totalIssues: number;
  pages: PageResult[];
  scannedAt: string;
}

export interface ParsedPage {
  url: string;
  html: string;
  type: SiteType;
  truncated?: boolean;
}
