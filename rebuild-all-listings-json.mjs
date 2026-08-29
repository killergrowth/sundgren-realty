/**
 * rebuild-all-listings-json.mjs
 * Scans all source listing pages and rebuilds data/all-listings.json
 * from data/repliers-listings.json + all-listings page dirs.
 * Run when all-listings.json is out of sync with what's actually built.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the full raw listing data written by generate-all-listings.mjs
// The generator writes per-run data; we need to reconstruct the full set
// by re-fetching from the manifest + scanning built dirs.

// Strategy: scan listings/{type}/{slug}/index.html, parse key fields from HTML
function parseListingHtml(html, type, slug) {
  const get = (re) => { const m = html.match(re); return m ? m[1].trim() : null; };

  const price = (() => {
    const m = html.match(/font-size:32px[^>]+>([^<]+)</);
    if (!m) return 0;
    const s = m[1].replace(/[^0-9]/g, '');
    return s ? parseInt(s) : 0;
  })();

  const heroImg = get(/og:image" content="([^"]+)"/) || '';
  const city    = get(/address\.city[^"]*"([^"]+)"/) || '';
  const mls     = get(/MLS#\s*([A-Za-z0-9]+)/) || get(/mlsNumber.*?"([^"]+)"/) || slug.split('-').pop();
  const lat     = (() => { const m = html.match(/setView\(\[([0-9.\-]+),/); return m ? parseFloat(m[1]) : null; })();
  const lng     = (() => { const m = html.match(/setView\(\[[0-9.\-]+,([0-9.\-]+)/); return m ? parseFloat(m[1]) : null; })();
  const beds    = (() => { const m = html.match(/>(\d+)<\/span><span[^>]*>Beds</); return m ? parseInt(m[1]) : null; })();
  const baths   = (() => { const m = html.match(/>(\d+)<\/span><span[^>]*>Baths</); return m ? parseInt(m[1]) : null; })();
  const sqft    = (() => { const m = html.match(/>([0-9,]+)<\/span><span[^>]*>Sq Ft</); return m ? m[1].replace(/,/g,'') : null; })();
  const acres   = (() => { const m = html.match(/>([0-9.]+)<\/span><span[^>]*>Acres</); return m ? parseFloat(m[1]) : null; })();

  // Extract address from h1
  const street  = get(/<h1[^>]*style="[^"]*color:#fff[^"]*"[^>]*>([^<]+)</) || slug;
  const addrRaw = get(/<p[^>]*color:rgba\(255,255,255,\.9\)[^>]*>([^<]+)</) || '';
  const addrParts = addrRaw.split(',').map(s => s.trim());
  const stateZip = addrParts[1] || '';
  const statePart = stateZip.split(' ')[0] || 'KS';

  return {
    slug,
    mlsNumber: mls,
    type,
    address: [street, addrRaw].filter(Boolean).join(', '),
    city: addrParts[0] || '',
    state: statePart,
    lat,
    lng,
    price,
    beds,
    baths,
    sqft,
    acres,
    status: 'A',
    image: heroImg,
    style: '',
  };
}

const types = ['residential', 'land', 'commercial'];
const all = [];

for (const type of types) {
  const dir = path.join(__dirname, 'listings', type);
  if (!fs.existsSync(dir)) continue;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const slugs = entries.filter(e => e.isDirectory()).map(e => e.name);
  for (const slug of slugs) {
    const htmlPath = path.join(dir, slug, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;
    const html = fs.readFileSync(htmlPath, 'utf8');
    const listing = parseListingHtml(html, type, slug);
    all.push(listing);
  }
  console.log(`${type}: ${slugs.length} listings`);
}

fs.writeFileSync(path.join(__dirname, 'data/all-listings.json'), JSON.stringify(all, null, 2), 'utf8');
console.log(`\nDone. data/all-listings.json rebuilt with ${all.length} total listings.`);
