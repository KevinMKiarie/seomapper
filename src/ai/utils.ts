import * as cheerio from 'cheerio';

export interface RawSuggestion {
  rule: string;
  explanation: string;
  codefix: string | null;
}

export function extractPageContext(html: string): string {
  const $ = cheerio.load(html);
  const head = $('head').html()?.trim() ?? '';
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 800);
  return `<head>\n${head}\n</head>\n\nBody preview:\n${bodyText}`;
}

export function parseAiResponse(text: string): RawSuggestion[] {
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  try {
    return JSON.parse(cleaned) as RawSuggestion[];
  } catch {
    return [];
  }
}
