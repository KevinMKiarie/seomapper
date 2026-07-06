import OpenAI from 'openai';
import { PageResult } from '../types.js';
import { AIProvider } from './provider.js';
import { fetchStatic } from '../crawler/static.js';
import { RawSuggestion, extractPageContext, parseAiResponse } from './utils.js';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async enrich(pages: PageResult[]): Promise<PageResult[]> {
    const enriched: PageResult[] = [];

    for (const page of pages) {
      if (page.issues.length === 0) {
        enriched.push(page);
        continue;
      }

      try {
        const { html } = await fetchStatic(page.url);
        const context = extractPageContext(html);
        const suggestions = await this.getSuggestions(page, context);
        const byRule = new Map(suggestions.map(s => [s.rule, s]));

        enriched.push({
          ...page,
          issues: page.issues.map(issue => {
            const s = byRule.get(issue.rule);
            return s
              ? { ...issue, aiSuggestion: { explanation: s.explanation, codefix: s.codefix } }
              : issue;
          }),
        });
      } catch {
        enriched.push(page);
      }
    }

    return enriched;
  }

  private async getSuggestions(page: PageResult, context: string): Promise<RawSuggestion[]> {
    const issueList = JSON.stringify(
      page.issues.map(i => ({ rule: i.rule, message: i.message, fix: i.fix })),
      null,
      2
    );

    const prompt = `You are a senior SEO engineer auditing a website. Provide specific, actionable code fixes.

URL: ${page.url}

Page HTML context:
\`\`\`html
${context}
\`\`\`

SEO issues found:
${issueList}

For each issue return a JSON object:
- "rule": exact rule id from the input
- "explanation": one sentence on why this impacts rankings or AI Search visibility
- "codefix": the exact HTML, meta tag, or JSON-LD snippet to add or replace (null if not code-level)

Return ONLY a valid JSON array. No markdown fences, no prose outside the array.`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
    });

    const text = response.choices[0]?.message?.content ?? '';
    return parseAiResponse(text);
  }
}
