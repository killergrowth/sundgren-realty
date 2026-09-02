/**
 * build.js — Sundgren Realty
 * Assembles all source HTML files + partials into dist/
 * Run: node build.js
 * Then deploy dist/ to Cloudflare Pages
 */

const fs   = require('fs');
const path = require('path');

const ROOT     = __dirname;
const DIST     = path.join(ROOT, 'dist');
const PARTIALS = path.join(ROOT, '_partials');

const { injectScripts, loadSiteScripts } = (() => {
  const libPath = 'C:\\Users\\KillerGrowth\\.openclaw\\workspace\\tools\\kg-site-builder\\lib\\inject-scripts';
  try { return require(libPath); } catch { return { injectScripts: (h) => h, loadSiteScripts: () => ({}) }; }
})();
const SITE_ID = 'sundgren-realty';

// BOM-safe file reader
function read(p) {
  const buf = fs.readFileSync(p);
  const start = (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) ? 3 : 0;
  return buf.slice(start).toString('utf8');
}

function assemble(html, header, footer) {
  return html
    .replace('<!-- HEADER -->', header)
    .replace('<!-- FOOTER -->', footer);
}

function write(destPath, content) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const scripts = loadSiteScripts(SITE_ID);
  const injected = injectScripts(content, scripts);
  fs.writeFileSync(destPath, injected, 'utf8');
}

// Pages: [source, dest-path-in-dist]
const PAGES = [
  ['index.html',           'index.html'],
  ['land-listings.html',   'land-listings/index.html'],
  ['property-search.html', 'property-search/index.html'],
  ['commercial.html',      'commercial/index.html'],
  ['residential.html',     'residential/index.html'],
  ['agents.html',          'agents/index.html'],
  ['news.html',            'news/index.html'],
  ['contact-us.html',      'contact-us/index.html'],
  ['value-my-land.html',   'value-my-land/index.html'],
  ['privacy-policy.html',  'privacy-policy/index.html'],
  ['404.html',             '404.html'],
];

function discoverAuctionPages() {
  const auctionsDir = path.join(ROOT, 'auctions');
  const pages = [];
  if (!fs.existsSync(auctionsDir)) return pages;
  // index
  const indexSrc = path.join(auctionsDir, 'index.html');
  if (fs.existsSync(indexSrc)) pages.push([indexSrc, path.join(DIST, 'auctions', 'index.html')]);
  // slug subdirs
  fs.readdirSync(auctionsDir, { withFileTypes: true }).forEach(entry => {
    if (!entry.isDirectory()) return;
    const slugIndex = path.join(auctionsDir, entry.name, 'index.html');
    if (fs.existsSync(slugIndex)) {
      pages.push([slugIndex, path.join(DIST, 'auctions', entry.name, 'index.html')]);
    }
  });
  return pages;
}

function discoverListingPages() {
  const pages = [];

  // Discover listings/ index + type subdirs + slug subdirs (two levels deep)
  const listingsDir = path.join(ROOT, 'listings');
  if (fs.existsSync(listingsDir)) {
    const listingsIndex = path.join(listingsDir, 'index.html');
    if (fs.existsSync(listingsIndex)) pages.push([listingsIndex, path.join(DIST, 'listings', 'index.html')]);
    fs.readdirSync(listingsDir, { withFileTypes: true }).forEach(typeEntry => {
      if (!typeEntry.isDirectory()) return;
      const typeDir = path.join(listingsDir, typeEntry.name);
      // Check for type-level index (e.g. listings/commercial/index.html)
      const typeIndex = path.join(typeDir, 'index.html');
      if (fs.existsSync(typeIndex)) {
        pages.push([typeIndex, path.join(DIST, 'listings', typeEntry.name, 'index.html')]);
      }
      // Recurse into slug subdirs
      fs.readdirSync(typeDir, { withFileTypes: true }).forEach(slugEntry => {
        if (!slugEntry.isDirectory()) return;
        const slugIndex = path.join(typeDir, slugEntry.name, 'index.html');
        if (fs.existsSync(slugIndex)) {
          pages.push([slugIndex, path.join(DIST, 'listings', typeEntry.name, slugEntry.name, 'index.html')]);
        }
      });
    });
  }

  // Discover commercial subpages
  const commercialDir = path.join(ROOT, 'commercial');
  if (fs.existsSync(commercialDir)) {
    fs.readdirSync(commercialDir, { withFileTypes: true }).forEach(entry => {
      if (!entry.isDirectory()) return;
      const slugIndex = path.join(commercialDir, entry.name, 'index.html');
      if (fs.existsSync(slugIndex)) {
        pages.push([slugIndex, path.join(DIST, 'commercial', entry.name, 'index.html')]);
      }
    });
  }
  return pages;
}

function buildSitemap() {
  const today = new Date().toISOString().split('T')[0];
  const baseUrl = 'https://sundgrenrealty.com';

  // Collect static pages
  const staticUrls = [
    { url: '/', priority: '1.0', freq: 'monthly' },
    { url: '/land-listings/', priority: '0.8', freq: 'monthly' },
  { url: '/residential/',   priority: '0.8', freq: 'weekly' },
    { url: '/auctions/', priority: '0.9', freq: 'daily' },
    { url: '/agents/', priority: '0.7', freq: 'monthly' },
    { url: '/news/', priority: '0.7', freq: 'weekly' },
    { url: '/contact-us/', priority: '0.7', freq: 'monthly' },
    { url: '/listings/', priority: '0.8', freq: 'weekly' },
  ];

  // Collect listing subpages from dist
  const listingsUrls = [];
  const listingsDistDir = path.join(DIST, 'listings');
  if (fs.existsSync(listingsDistDir)) {
    fs.readdirSync(listingsDistDir, { withFileTypes: true }).forEach(entry => {
      if (entry.isDirectory()) {
        listingsUrls.push({ url: `/listings/${entry.name}/`, priority: '0.8', freq: 'weekly' });
      }
    });
  }

  // Collect auction pages from dist
  const auctionUrls = [];
  const auctionDistDir = path.join(DIST, 'auctions');
  if (fs.existsSync(auctionDistDir)) {
    fs.readdirSync(auctionDistDir, { withFileTypes: true }).forEach(entry => {
      if (entry.isDirectory()) {
        auctionUrls.push({ url: `/auctions/${entry.name}/`, priority: '0.7', freq: 'weekly' });
      }
    });
  }

  // Collect commercial listing pages from dist
  const commercialUrls = [];
  const commercialDistDir = path.join(DIST, 'commercial');
  if (fs.existsSync(commercialDistDir)) {
    fs.readdirSync(commercialDistDir, { withFileTypes: true }).forEach(entry => {
      if (entry.isDirectory()) {
        commercialUrls.push({ url: `/commercial/${entry.name}/`, priority: '0.8', freq: 'weekly' });
      }
    });
  }

  // Collect Repliers listing pages (listings/{type}/{slug}/)
  const repliersUrls = [];
  const repliersDistDir = path.join(DIST, 'listings');
  if (fs.existsSync(repliersDistDir)) {
    fs.readdirSync(repliersDistDir, { withFileTypes: true }).forEach(typeEntry => {
      if (!typeEntry.isDirectory()) return;
      const typeDir = path.join(repliersDistDir, typeEntry.name);
      fs.readdirSync(typeDir, { withFileTypes: true }).forEach(slugEntry => {
        if (slugEntry.isDirectory()) {
          repliersUrls.push({ url: `/listings/${typeEntry.name}/${slugEntry.name}/`, priority: '0.8', freq: 'weekly' });
        }
      });
    });
  }

  const allUrls = [...staticUrls, ...auctionUrls, ...commercialUrls, ...listingsUrls, ...repliersUrls];
  const urlEntries = allUrls.map(u =>
    `  <url>\n    <loc>${baseUrl}${u.url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml, 'utf8');
  console.log(`  sitemap.xml: ${allUrls.length} URLs`);
}

function main() {
  console.log('Building Sundgren Realty...');

  const header = read(path.join(PARTIALS, 'header.html'));
  const footer = read(path.join(PARTIALS, 'footer.html'));

  fs.mkdirSync(DIST, { recursive: true });

  // Load Sundgren featured listings data for homepage injection
  const allListings = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'all-listings.json'), 'utf8'));
  const sundgrenFeatured = allListings.filter(l => l.isSundgren && l.status === 'A' && l.image);
  const sundgrenFeaturedJSON = JSON.stringify(sundgrenFeatured);

  // Static pages
  let count = 0;
  for (const [src, dest] of PAGES) {
    const srcPath  = path.join(ROOT, src);
    const destPath = path.join(DIST, dest);
    if (!fs.existsSync(srcPath)) { console.warn(`  SKIP (missing): ${src}`); continue; }
    let html = assemble(read(srcPath), header, footer);
    // Inject Sundgren featured data into homepage
    if (src === 'index.html') {
      html = html.replace('__SUNDGREN_FEATURED__', sundgrenFeaturedJSON);
    }
    write(destPath, html);
    console.log(`  Built: ${dest}`);
    count++;
  }

  // Auction pages discovered from auctions/
  const auctionPages = discoverAuctionPages();
  for (const [srcPath, destPath] of auctionPages) {
    const html = assemble(read(srcPath), header, footer);
    write(destPath, html);
    console.log(`  Built: auctions/${path.relative(path.join(DIST, 'auctions'), destPath)}`);
    count++;
  }

  // Listing pages discovered from listings/ (commercial/residential/land subdirs)
  const listingPages = discoverListingPages();
  for (const [srcPath, destPath] of listingPages) {
    const html = assemble(read(srcPath), header, footer);
    write(destPath, html);
    console.log(`  Built: ${path.relative(DIST, destPath)}`);
    count++;
  }

  // Static assets: copy css/, js/, images/, robots.txt, _worker.js, _routes.json, _redirects, 404.html
  const COPY_DIRS = ['css', 'js', 'images', 'fonts', 'fontawesome'];
  for (const dir of COPY_DIRS) {
    const srcDir  = path.join(ROOT, dir);
    const destDir = path.join(DIST, dir);
    if (!fs.existsSync(srcDir)) continue;
    copyDir(srcDir, destDir);
  }

  const COPY_FILES = ['robots.txt', '_worker.js', '_routes.json', '_redirects'];
  for (const f of COPY_FILES) {
    const src = path.join(ROOT, f);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, path.join(DIST, f));
  }

  // Copy functions/ into dist/functions/
  const funcSrc  = path.join(ROOT, 'functions');
  const funcDest = path.join(DIST, 'functions');
  if (fs.existsSync(funcSrc)) copyDir(funcSrc, funcDest);

  // Build sitemap
  buildSitemap();

  console.log(`\nDone. ${count} pages built to dist/`);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src, { withFileTypes: true }).forEach(entry => {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  });
}

main();
