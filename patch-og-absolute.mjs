/**
 * patch-og-absolute.mjs
 * Makes og:image and twitter:image use absolute URLs for social crawlers.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://sundgren-realty.pages.dev';

const SOURCE_FILES = [
  'index.html',
  'land-listings.html',
  'agents.html',
  'news.html',
  'contact-us.html',
  'privacy-policy.html',
  '404.html',
  'auctions/index.html',
];

let patched = 0;

for (const relPath of SOURCE_FILES) {
  const filePath = path.join(__dirname, relPath);
  if (!fs.existsSync(filePath)) { console.warn('SKIP:', relPath); continue; }

  let html = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Fix og:image relative path → absolute
  const ogFixed = html.replace(
    /<meta property="og:image" content="\/images\//g,
    `<meta property="og:image" content="${BASE}/images/`
  );
  if (ogFixed !== html) { html = ogFixed; changed = true; }

  // Fix twitter:image relative path → absolute
  const twFixed = html.replace(
    /<meta name="twitter:image" content="\/images\//g,
    `<meta name="twitter:image" content="${BASE}/images/`
  );
  if (twFixed !== html) { html = twFixed; changed = true; }

  // Ensure og:image:secure_url is present
  if (!html.includes('og:image:secure_url') && html.includes('og:image')) {
    html = html.replace(
      `<meta property="og:image:width"`,
      `<meta property="og:image:secure_url" content="${BASE}/images/og-preview.png">\n  <meta property="og:image:width"`
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, html, 'utf8');
    console.log('Patched:', relPath);
    patched++;
  } else {
    console.log('No change:', relPath);
  }
}

console.log(`\nDone. ${patched} files patched.`);
