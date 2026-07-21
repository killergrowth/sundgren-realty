/**
 * patch-head.mjs
 * Updates all site HTML source files to use SVG favicon + correct OG image.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TARGET_FILES = [
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

for (const relPath of TARGET_FILES) {
  const filePath = path.join(__dirname, relPath);
  if (!fs.existsSync(filePath)) { console.warn('SKIP (missing):', relPath); continue; }

  let html = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Replace favicon.ico with favicon.svg
  if (html.includes('favicon.ico')) {
    html = html.replace(
      /<link rel="icon" href="\/images\/favicon\.ico" type="image\/x-icon">/g,
      `<link rel="icon" href="/images/favicon.svg" type="image/svg+xml">\n  <link rel="apple-touch-icon" href="/images/apple-touch-icon.svg">`
    );
    changed = true;
  }

  // Inject OG image meta if twitter:card exists but og:image is missing
  if (!html.includes('og:image') && html.includes('twitter:card')) {
    html = html.replace(
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:card" content="summary_large_image">
  <meta property="og:image" content="/images/og-preview.png">
  <meta property="og:image:width" content="1536">
  <meta property="og:image:height" content="1024">
  <meta name="twitter:image" content="/images/og-preview.png">`
    );
    changed = true;
  }

  // Update og:image if it already exists but points to wrong path
  if (html.includes('og:image') && !html.includes('og-preview.png')) {
    html = html.replace(
      /<meta property="og:image" content="[^"]*">/,
      `<meta property="og:image" content="/images/og-preview.png">`
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, html, 'utf8');
    console.log('Patched:', relPath);
    patched++;
  } else {
    console.log('Skip (no change):', relPath);
  }
}

console.log(`\nDone. ${patched} files patched.`);
