import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { resolvePath } from '../config';

const MAX_PAGES = 50;
const FETCH_TIMEOUT_MS = 15000;

export interface ScrapedPage {
  url: string;
  htmlPath: string;
  textPath: string;
  text: string;
}

export interface CrawledPage {
  url: string;
  html: string;
  text: string;
}

function normalizeUrl(href: string, base: string): string | null {
  try {
    const resolved = new URL(href, base);
    if (!['http:', 'https:'].includes(resolved.protocol)) return null;
    resolved.hash = '';
    return resolved.href.replace(/\/$/, '');
  } catch {
    return null;
  }
}

function sameOrigin(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin;
  } catch {
    return false;
  }
}

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SiteScraper/1.0 (+https://github.com/simple-scraper)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error(`Non-HTML content: ${contentType}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export function extractVisibleText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, iframe').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

function extractLinks(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const normalized = normalizeUrl(href, pageUrl);
    if (normalized) links.push(normalized);
  });
  return links;
}

/** BFS crawl of same-origin pages; returns each page's URL, HTML, and extracted text. */
export async function crawlWebsite(startUrl: string): Promise<CrawledPage[]> {
  const start = normalizeUrl(startUrl, startUrl);
  if (!start) throw new Error(`Invalid start URL: ${startUrl}`);

  const visited = new Set<string>();
  const queue: string[] = [start];
  const pages: CrawledPage[] = [];

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    let html: string;
    try {
      html = await fetchPage(current);
    } catch {
      continue;
    }

    pages.push({ url: current, html, text: extractVisibleText(html) });

    for (const link of extractLinks(html, current)) {
      if (sameOrigin(start, link) && !visited.has(link)) {
        queue.push(link);
      }
    }
  }

  return pages;
}

/** Discover page URLs via same-origin spider (no temp files). */
export async function discoverPageUrls(startUrl: string): Promise<string[]> {
  const pages = await crawlWebsite(startUrl);
  return pages.map((p) => p.url);
}

/** Fetch and extract visible text from a single page. */
export async function scrapePageText(url: string): Promise<{ url: string; text: string }> {
  const html = await fetchPage(url);
  return { url, text: extractVisibleText(html) };
}

export async function spiderWebsite(
  startUrl: string,
  tempDir: string
): Promise<ScrapedPage[]> {
  fs.mkdirSync(tempDir, { recursive: true });
  const crawled = await crawlWebsite(startUrl);
  const pages: ScrapedPage[] = [];

  for (const page of crawled) {
    const slug = Buffer.from(page.url).toString('base64url').slice(0, 32);
    const htmlPath = path.join(tempDir, `${slug}.html`);
    const textPath = path.join(tempDir, `${slug}.txt`);
    fs.writeFileSync(htmlPath, page.html, 'utf-8');
    fs.writeFileSync(textPath, page.text, 'utf-8');
    pages.push({
      url: page.url,
      htmlPath,
      textPath,
      text: page.text,
    });
  }

  return pages;
}

export function cleanupTempDir(tempDir: string): void {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function getOutputDir(): string {
  const dir = resolvePath(process.env.OUTPUT_FOLDER ?? './output');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
