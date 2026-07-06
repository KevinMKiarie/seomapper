import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { scan } from './scanner.js';
import { resolveUrl } from './utils/url.js';

const TOOLS = [
  {
    name: 'scan_site',
    description: 'Crawl a website and return SEO issues for all pages. Returns scores, issues by severity, and fix hints.',
    inputSchema: {
      type: 'object',
      properties: {
        url:   { type: 'string', description: 'Website URL to scan' },
        depth: { type: 'number', description: 'Max pages to crawl (default: 10)', default: 10 },
      },
      required: ['url'],
    },
  },
  {
    name: 'scan_page',
    description: 'Audit a single page and return its SEO issues and score.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Page URL to audit' },
      },
      required: ['url'],
    },
  },
  {
    name: 'list_rules',
    description: 'List all SEO rule IDs that seomapper checks, with descriptions.',
    inputSchema: { type: 'object', properties: {} },
  },
];

const SEO_RULES = [
  // Core metadata
  { id: 'title-missing',        category: 'meta',      description: 'Page has no <title> tag' },
  { id: 'title-too-short',      category: 'meta',      description: 'Title under 30 characters — too short for SERPs' },
  { id: 'title-too-long',       category: 'meta',      description: 'Title over 60 characters — truncated in SERPs' },
  { id: 'description-missing',  category: 'meta',      description: 'No meta description found' },
  { id: 'description-too-short',category: 'meta',      description: 'Meta description under 120 characters' },
  { id: 'description-too-long', category: 'meta',      description: 'Meta description over 160 characters' },
  { id: 'viewport-missing',     category: 'meta',      description: 'No viewport meta tag — breaks mobile rendering' },
  { id: 'html-lang-missing',    category: 'meta',      description: 'Missing lang attribute on <html>' },
  { id: 'canonical-missing',    category: 'meta',      description: 'No canonical URL declared' },
  { id: 'noindex-detected',     category: 'meta',      description: 'Page has noindex — search engines will skip it' },
  { id: 'meta-refresh',         category: 'meta',      description: '<meta http-equiv="refresh"> used for redirect — use 301 instead' },
  // Open Graph
  { id: 'og-title-missing',       category: 'og', description: 'Missing og:title' },
  { id: 'og-description-missing', category: 'og', description: 'Missing og:description' },
  { id: 'og-image-missing',       category: 'og', description: 'Missing og:image' },
  { id: 'og-type-missing',        category: 'og', description: 'Missing og:type' },
  { id: 'og-url-missing',         category: 'og', description: 'Missing og:url' },
  { id: 'twitter-card-missing',   category: 'og', description: 'Missing twitter:card — no rich Twitter/X preview' },
  { id: 'favicon-missing',        category: 'og', description: 'No favicon declared in <head>' },
  // Page structure
  { id: 'h1-missing',            category: 'structure', description: 'Page has no H1 heading' },
  { id: 'multiple-h1',           category: 'structure', description: 'More than one H1 on the page' },
  { id: 'heading-skip',          category: 'structure', description: 'Heading level skipped (e.g. H1 → H3)' },
  { id: 'image-alt-missing',     category: 'structure', description: 'Images missing alt attributes' },
  { id: 'semantic-html-missing', category: 'structure', description: 'Page missing semantic landmarks (<main>, <nav>)' },
  // Content quality
  { id: 'thin-content',               category: 'content', description: 'Page body under 300 words — likely too thin for AEO' },
  { id: 'generic-anchor-text',        category: 'content', description: 'Links use "click here" or "read more"' },
  { id: 'image-filename-generic',     category: 'content', description: 'Images have non-descriptive filenames' },
  { id: 'content-freshness-missing',  category: 'content', description: 'Article page with no date signal' },
  { id: 'duplicate-title',            category: 'content', description: 'Same <title> used on multiple scanned pages' },
  { id: 'duplicate-description',      category: 'content', description: 'Same meta description used on multiple scanned pages' },
  // Links
  { id: 'nofollow-internal', category: 'links', description: 'Internal links carry rel="nofollow"' },
  { id: 'hreflang-missing',  category: 'links', description: 'Language-specific URL without hreflang alternate links' },
  // Site-level
  { id: 'robots-txt-missing', category: 'site', description: 'No robots.txt at domain root' },
  { id: 'sitemap-missing',    category: 'site', description: 'No sitemap.xml at domain root' },
  // Structured data
  { id: 'schema-missing',       category: 'schema', description: 'No JSON-LD structured data found' },
  { id: 'schema-invalid-json',  category: 'schema', description: 'Invalid JSON in a JSON-LD block' },
  { id: 'schema-no-context',    category: 'schema', description: 'JSON-LD missing @context' },
  { id: 'schema-no-type',       category: 'schema', description: 'JSON-LD missing @type' },
  // AEO / AI Search
  { id: 'faq-schema-missing',          category: 'aeo', description: 'FAQ content detected but no FAQPage schema' },
  { id: 'article-schema-missing',      category: 'aeo', description: 'Article page without Article/BlogPosting schema' },
  { id: 'eeat-author-missing',         category: 'aeo', description: 'No author markup — weakens E-E-A-T signals' },
  { id: 'breadcrumb-schema-missing',   category: 'aeo', description: 'No BreadcrumbList schema' },
  { id: 'organization-schema-missing', category: 'aeo', description: 'No Organization schema' },
  { id: 'speakable-missing',           category: 'aeo', description: 'Article page with no Speakable schema' },
  { id: 'video-schema-missing',        category: 'aeo', description: 'Video content without VideoObject schema' },
  { id: 'product-schema-missing',      category: 'aeo', description: 'Product page without Product schema' },
  // Security
  { id: 'http-not-https',                   category: 'security', description: 'Page served over HTTP' },
  { id: 'mixed-content',                    category: 'security', description: 'HTTP resources on an HTTPS page' },
  { id: 'hsts-missing',                     category: 'security', description: 'Missing Strict-Transport-Security header' },
  { id: 'x-content-type-missing',           category: 'security', description: 'Missing X-Content-Type-Options header' },
  { id: 'clickjacking-protection-missing',  category: 'security', description: 'No X-Frame-Options or CSP frame-ancestors protection' },
  // Resilience
  { id: 'page-truncated', category: 'info', description: 'Page HTML exceeded scan limit — body results may be partial' },
];

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: 'seomapper', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    if (name === 'list_rules') {
      return {
        content: [{ type: 'text', text: JSON.stringify(SEO_RULES, null, 2) }],
      };
    }

    if (name === 'scan_page') {
      const url = await resolveUrl(args['url'] as string);
      const result = await scan(url, { depth: 1, output: 'json', ignore: [] });
      return {
        content: [{ type: 'text', text: JSON.stringify(result.pages[0] ?? {}, null, 2) }],
      };
    }

    if (name === 'scan_site') {
      const url = await resolveUrl(args['url'] as string);
      const depth = typeof args['depth'] === 'number' ? args['depth'] : 10;
      const result = await scan(url, { depth, output: 'json', ignore: [] });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
