/**
 * inject-auctions.mjs
 * Copies auctions/ source files to dist/auctions/ with header/footer injected.
 * Faster than running full build.js for auction-only updates.
 */
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC  = path.join(__dirname, 'auctions');
const DIST = path.join(__dirname, 'dist', 'auctions');

const header = fs.readFileSync(path.join(__dirname, '_partials', 'header.html'), 'utf8');
const footer = fs.readFileSync(path.join(__dirname, '_partials', 'footer.html'), 'utf8');

// Also copy updated CSS
const cssSrc  = path.join(__dirname, 'css', 'sundgren.css');
const cssDist = path.join(__dirname, 'dist', 'css', 'sundgren.css');
fs.copyFileSync(cssSrc, cssDist);
console.log('Copied css/sundgren.css to dist/');

let count = 0;
const entries = fs.readdirSync(SRC, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const slug    = entry.name;
  const srcFile = path.join(SRC, slug, 'index.html');
  const distDir = path.join(DIST, slug);
  const distFile = path.join(distDir, 'index.html');
  if (!fs.existsSync(srcFile)) continue;

  const raw  = fs.readFileSync(srcFile, 'utf8');
  const html = raw.replace('<!-- HEADER -->', header).replace('<!-- FOOTER -->', footer);
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(distFile, html, 'utf8');
  count++;
}

// Also copy index
const indexSrc  = path.join(SRC, 'index.html');
const indexDist = path.join(DIST, 'index.html');
if (fs.existsSync(indexSrc)) {
  const raw  = fs.readFileSync(indexSrc, 'utf8');
  const html = raw.replace('<!-- HEADER -->', header).replace('<!-- FOOTER -->', footer);
  fs.writeFileSync(indexDist, html, 'utf8');
  console.log('Copied auctions/index.html to dist/');
}

console.log(`Done. Injected ${count} auction detail pages into dist/auctions/`);
