import * as cheerio from 'cheerio';
import { Issue } from '../types.js';
import { extractJsonLd } from './schema.js';

// Rules targeting Google AI Overviews and AI Search eligibility.
// Source: https://developers.google.com/search/docs/appearance/structured-data
export function checkAiSearch(html: string): Issue[] {
  const $ = cheerio.load(html);
  const issues: Issue[] = [];

  const blocks = extractJsonLd(html);
  const schemaTypes = blocks
    .map(b => b['@type'] as string | undefined)
    .filter(Boolean) as string[];

  // Detect Q&A patterns: <details>, FAQ headings, accordion-style elements
  const hasFaqContent =
    $('details').length > 0 ||
    $('[class*="faq"],[id*="faq"],[class*="accordion"]').length > 0 ||
    $('h2,h3').filter((_, el) =>
      /faq|frequently asked/i.test($(el).text())
    ).length > 0;

  if (hasFaqContent && !schemaTypes.includes('FAQPage')) {
    issues.push({
      rule: 'faq-schema-missing',
      severity: 'warning',
      message: 'FAQ content detected but no FAQPage schema found',
      fix: 'Add FAQPage JSON-LD to qualify for Google FAQ rich results and AI Overview citations',
    });
  }

  // Article / BlogPosting schema 
  const isArticlePage =
    $('article').length > 0 ||
    /\b(article|post|blog)\b/i.test($('body').attr('class') ?? '') ||
    /\b(article|post|blog)\b/i.test($('main').attr('class') ?? '');

  const hasArticleSchema =
    schemaTypes.includes('Article') || schemaTypes.includes('BlogPosting');

  if (isArticlePage && !hasArticleSchema) {
    issues.push({
      rule: 'article-schema-missing',
      severity: 'warning',
      message: 'Article page detected but no Article/BlogPosting schema found',
      fix: 'Add Article JSON-LD with headline, author, and datePublished for E-E-A-T signals',
    });
  }

  // Google uses author signals to evaluate Experience, Expertise, Authority, Trust
  const hasAuthorInSchema = blocks.some(
    b => (b['@type'] === 'Article' || b['@type'] === 'BlogPosting') && b['author']
  );
  const hasAuthorInDom =
    $('[rel="author"],[itemprop="author"],.author,#author,[class*="author"]').length > 0;

  if (!hasAuthorInSchema && !hasAuthorInDom) {
    issues.push({
      rule: 'eeat-author-missing',
      severity: 'info',
      message: 'No author markup found — weakens E-E-A-T signals used by AI Search',
      fix: 'Add author via JSON-LD Person schema or visible author attribution with rel="author"',
    });
  }

  // helps AI understand site hierarchy and navigation context
  if (!schemaTypes.includes('BreadcrumbList')) {
    issues.push({
      rule: 'breadcrumb-schema-missing',
      severity: 'info',
      message: 'No BreadcrumbList schema found',
      fix: 'Add BreadcrumbList JSON-LD to give AI search context about your site structure',
    });
  }

  // recommended on every page to establish site identity
  if (!schemaTypes.includes('Organization') && !schemaTypes.includes('LocalBusiness')) {
    issues.push({
      rule: 'organization-schema-missing',
      severity: 'info',
      message: 'No Organization schema found',
      fix: 'Add Organization JSON-LD with name, url, and logo to establish site identity',
    });
  }

  // Speakable schema marks sections suitable for Google Assistant / AI voice synthesis.
  // Google explicitly recommends this for news and informational pages.
  if (!schemaTypes.includes('Speakable') && !blocks.some(b => b['speakable'])) {
    const isNewsOrInfo =
      schemaTypes.includes('Article') ||
      schemaTypes.includes('BlogPosting') ||
      schemaTypes.includes('NewsArticle');
    if (isNewsOrInfo) {
      issues.push({
        rule: 'speakable-missing',
        severity: 'info',
        message: 'Article page has no Speakable schema — AI voice assistants cannot identify the key sections',
        fix: 'Add a Speakable property to your Article JSON-LD pointing at the cssSelector of your headline and summary',
      });
    }
  }

  // Video content without VideoObject schema is invisible to Google Video Search and AI Overviews
  const hasVideoInDom =
    $('video').length > 0 ||
    $('iframe[src*="youtube.com"], iframe[src*="youtu.be"], iframe[src*="vimeo.com"]').length > 0;
  const hasVideoSchema =
    schemaTypes.includes('VideoObject') || schemaTypes.includes('Video');
  if (hasVideoInDom && !hasVideoSchema) {
    issues.push({
      rule: 'video-schema-missing',
      severity: 'warning',
      message: 'Video content detected but no VideoObject schema found',
      fix: 'Add VideoObject JSON-LD with name, description, thumbnailUrl, and uploadDate for video rich results',
    });
  }

  // Product pages without Product schema miss price/availability rich results
  const isProductPage =
    $('[class*="product"],[id*="product"],[itemtype*="Product"]').length > 0 ||
    $('[class*="add-to-cart"],[class*="buy-now"],[class*="price"]').length > 0 ||
    /\/(product|shop|store)\//i.test($('link[rel="canonical"]').attr('href') ?? '');
  const hasProductSchema = schemaTypes.includes('Product');
  if (isProductPage && !hasProductSchema) {
    issues.push({
      rule: 'product-schema-missing',
      severity: 'warning',
      message: 'Product page detected but no Product schema found',
      fix: 'Add Product JSON-LD with name, image, description, offers (price + availability) for rich results',
    });
  }

  return issues;
}
