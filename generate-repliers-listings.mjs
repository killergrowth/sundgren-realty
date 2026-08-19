/**
 * generate-repliers-listings.mjs - Sundgren Realty
 *
 * Fetches listings from the Repliers API and generates:
 *   - listings/commercial/{slug}/index.html   (3 commercial)
 *   - listings/residential/{slug}/index.html  (3 residential)
 *   - listings/land/{slug}/index.html         (3 land)
 *
 * Pages use <!-- HEADER --> and <!-- FOOTER --> placeholders.
 * Run: node generate-repliers-listings.mjs
 * Then: node build.js
 *
 * NOTE: Currently using Repliers sample data (boardId 110).
 *       When SCKMLS access is live, remove the per_page=9 limit
 *       and add officeName filter for Sundgren listings.
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────
const REPLIERS_API_KEY = process.env.REPLIERS_API_KEY || '6OlTrbJFWoCUuzkqn5V9mwKgQPjLq6';
const REPLIERS_API_URL = 'https://api.repliers.io/listings';
const IMG_CDN_BASE     = 'https://cdn.repliers.io';
const SITE_DOMAIN      = 'https://sundgrenrealty.com';
const SITE_NAME        = 'Sundgren Realty & Auction';
const PHONE            = '316-321-7112';
const PHONE_LINK       = '3163217112';
const EMAIL            = 'realty@sundgren.com';

const LISTINGS_DIR = path.join(__dirname, 'listings');
const DIST_DIR     = path.join(__dirname, 'dist');

const DIRECT_MODE = process.argv.includes('--direct');

// ── How we designate listing types from sample data ──────────────────────────
// When real SCKMLS data is live, these map to actual MLS property types.
// For sample data we manually assign: first 3 = commercial, next 3 = residential, last 3 = land
const TYPE_MAP = [
  { type: 'commercial', label: 'Commercial', dir: 'commercial', backLink: '/commercial/', backLabel: 'All Commercial' },
  { type: 'commercial', label: 'Commercial', dir: 'commercial', backLink: '/commercial/', backLabel: 'All Commercial' },
  { type: 'commercial', label: 'Commercial', dir: 'commercial', backLink: '/commercial/', backLabel: 'All Commercial' },
  { type: 'residential', label: 'Residential', dir: 'residential', backLink: '/residential/', backLabel: 'All Residential' },
  { type: 'residential', label: 'Residential', dir: 'residential', backLink: '/residential/', backLabel: 'All Residential' },
  { type: 'residential', label: 'Residential', dir: 'residential', backLink: '/residential/', backLabel: 'All Residential' },
  { type: 'land', label: 'Land', dir: 'land', backLink: '/land-listings/', backLabel: 'All Land Listings' },
  { type: 'land', label: 'Land', dir: 'land', backLink: '/land-listings/', backLabel: 'All Land Listings' },
  { type: 'land', label: 'Land', dir: 'land', backLink: '/land-listings/', backLabel: 'All Land Listings' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 70)
    .replace(/-$/, '');
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(str) {
  return String(str || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(str, len) {
  const text = stripHtml(str);
  return text.length > len ? text.substring(0, len - 3) + '...' : text;
}

function formatPrice(price) {
  if (!price) return 'Contact for Price';
  return '$' + parseInt(price).toLocaleString();
}

function buildListingSlug(listing) {
  const addr = listing.address;
  const street = `${addr.streetNumber || ''} ${addr.streetName || ''} ${addr.streetSuffix || ''}`.trim();
  const city   = addr.city || '';
  const state  = addr.state || 'KS';
  return slugify(`${street} ${city} ${state}`) + '-' + listing.mlsNumber;
}

function imgUrl(imgPath) {
  if (!imgPath) return '';
  if (imgPath.startsWith('http')) return imgPath;
  return `${IMG_CDN_BASE}/${imgPath}`;
}

function statusPillClass(status) {
  const s = (status || '').toUpperCase();
  if (s === 'A' || s === 'ACTIVE') return 'pill-active';
  if (s === 'U') return 'pill-upcoming';
  return 'pill-sold';
}

function statusLabel(status) {
  const s = (status || '').toUpperCase();
  if (s === 'A' || s === 'ACTIVE') return 'ACTIVE';
  if (s === 'U') return 'PENDING';
  return 'CLOSED';
}

function fullAddress(addr) {
  const parts = [
    `${addr.streetNumber || ''} ${addr.streetName || ''} ${addr.streetSuffix || ''}`.trim(),
    addr.city,
    addr.state,
    addr.zip
  ].filter(Boolean);
  return parts.join(', ');
}

// ── Photo Mosaic + Lightbox ───────────────────────────────────────────────────
// Shows: 1 hero image (large) + up to 4 thumbnails in a strip.
// "View all N photos" button opens the full lightbox.
function renderPhotoGrid(images) {
  if (!images || !images.length) return '';
  const srcs = images.slice(0, 20).map(imgUrl).filter(Boolean);
  if (!srcs.length) return '';

  const hero   = srcs[0];
  const thumbs = srcs.slice(1, 5); // max 4 visible side thumbnails
  const total  = srcs.length;

  // Thumb cells — last one gets a "+N more" overlay if there are photos beyond visible
  const extraCount = total - 5; // photos not visible (hero=1, thumbs=4)
  const thumbCells = thumbs.map((src, i) => {
    const isLast = i === thumbs.length - 1 && extraCount > 0;
    const overlay = isLast
      ? `<div class="sg-mosaic-more" aria-hidden="true">+${extraCount} more</div>`
      : '';
    return `      <button class="sg-mosaic-thumb" data-idx="${i + 1}" aria-label="View photo ${i + 2}" type="button">
        <img src="${esc(src)}" alt="Property photo ${i + 2}" loading="lazy">
        ${overlay}
      </button>`;
  }).join('\n');

  return `
  <section class="photo-gallery-section" style="margin-bottom:24px;">
    <div class="sg-mosaic">
      <button class="sg-mosaic-hero" data-idx="0" aria-label="View photo 1" type="button">
        <img src="${esc(hero)}" alt="Primary property photo" loading="eager">
      </button>
      <div class="sg-mosaic-strip">
${thumbCells}
      </div>
    </div>
    <div class="sg-gallery-bar">
      <button class="sg-gallery-all-btn" id="sg-view-all" type="button">
        <i class="fas fa-images"></i> View all ${total} photo${total !== 1 ? 's' : ''}
      </button>
    </div>
  </section>

  <div id="sg-lightbox" role="dialog" aria-modal="true" aria-label="Photo gallery">
    <button id="sg-lightbox-close" aria-label="Close">&times;</button>
    <button id="sg-lightbox-prev" aria-label="Previous">&#8249;</button>
    <img id="sg-lightbox-img" src="" alt="Property photo">
    <button id="sg-lightbox-next" aria-label="Next">&#8250;</button>
    <span id="sg-lightbox-counter"></span>
  </div>

  <script>
  (function(){
    var srcs = [${srcs.map(s => `"${esc(s)}"`).join(',')}];
    var lb = document.getElementById('sg-lightbox');
    var lbImg = document.getElementById('sg-lightbox-img');
    var lbCtr = document.getElementById('sg-lightbox-counter');
    var cur = 0;
    function open(i){ cur=i; lbImg.src=srcs[i]; lbCtr.textContent=(i+1)+' / '+srcs.length; lb.classList.add('active'); document.body.style.overflow='hidden'; }
    function close(){ lb.classList.remove('active'); document.body.style.overflow=''; }
    document.querySelectorAll('.sg-mosaic-hero, .sg-mosaic-thumb').forEach(function(btn){
      btn.addEventListener('click',function(){ open(parseInt(btn.dataset.idx,10)); });
    });
    var viewAll = document.getElementById('sg-view-all');
    if (viewAll) viewAll.addEventListener('click', function(){ open(0); });
    document.getElementById('sg-lightbox-close').addEventListener('click',close);
    document.getElementById('sg-lightbox-prev').addEventListener('click',function(){ open((cur-1+srcs.length)%srcs.length); });
    document.getElementById('sg-lightbox-next').addEventListener('click',function(){ open((cur+1)%srcs.length); });
    lb.addEventListener('click',function(e){ if(e.target===lb) close(); });
    document.addEventListener('keydown',function(e){ if(!lb.classList.contains('active')) return; if(e.key==='Escape') close(); if(e.key==='ArrowLeft') open((cur-1+srcs.length)%srcs.length); if(e.key==='ArrowRight') open((cur+1)%srcs.length); });
  })();
  </script>`;
}

// ── Description Sections ─────────────────────────────────────────────────────
function renderDescription(desc) {
  if (!desc) return '';
  const clean = stripHtml(desc).replace(/\*\*\*\* SAMPLE DATA \*\*\*\*/g, '').trim();
  if (!clean) return '';
  // Split on double newlines or common section headers
  const paragraphs = clean.split(/\n{2,}/).filter(p => p.trim().length > 0);
  if (paragraphs.length <= 1) {
    return `<div class="desc-section">
      <h3 class="desc-section-title"><i class="fas fa-home"></i> Property Description</h3>
      <p>${esc(clean)}</p>
    </div>`;
  }
  return paragraphs.map((p, i) => {
    const icon = i === 0 ? 'fa-home' : 'fa-info-circle';
    return `<div class="desc-section">
      <h3 class="desc-section-title"><i class="fas ${icon}"></i> ${i === 0 ? 'Property Description' : 'Additional Details'}</h3>
      <p>${esc(p.trim())}</p>
    </div>`;
  }).join('\n');
}

// ── Info Card ────────────────────────────────────────────────────────────────
function renderInfoCard(listing, typeInfo) {
  const d = listing.details || {};
  const lot = listing.lot || {};
  const agent = (listing.agents || [])[0] || {};
  const agentName = agent.name || 'Sundgren Realty';
  const agentPhone = (agent.phones || [])[0] || PHONE;

  const metaItems = [];
  if (listing.listPrice) metaItems.push({ icon: 'fa-tag', label: 'Price', val: formatPrice(listing.listPrice) });
  if (d.numBedrooms) metaItems.push({ icon: 'fa-bed', label: 'Bedrooms', val: d.numBedrooms });
  if (d.numBathrooms) metaItems.push({ icon: 'fa-bath', label: 'Bathrooms', val: d.numBathrooms });
  if (d.sqft) metaItems.push({ icon: 'fa-ruler-combined', label: 'Sq Ft', val: parseInt(d.sqft).toLocaleString() });
  if (lot.acres) metaItems.push({ icon: 'fa-map', label: 'Acres', val: parseFloat(lot.acres).toFixed(2) });
  if (d.yearBuilt) metaItems.push({ icon: 'fa-calendar-alt', label: 'Year Built', val: d.yearBuilt });
  if (d.style) metaItems.push({ icon: 'fa-building', label: 'Style', val: d.style });
  if (listing.address.city) metaItems.push({ icon: 'fa-map-marker-alt', label: 'Location', val: `${listing.address.city}, ${listing.address.state}` });
  metaItems.push({ icon: 'fa-hashtag', label: 'MLS#', val: listing.mlsNumber });

  const metaHtml = metaItems.map(m =>
    `<li><i class="fas ${m.icon}"></i><div><span class="mlabel">${m.label}</span>${esc(String(m.val))}</div></li>`
  ).join('\n        ');

  const statusHtml = `<span class="${statusPillClass(listing.status)} pill" style="display:inline-block;margin-bottom:16px;">${statusLabel(listing.status)}</span>`;

  return `
    <div class="info-card">
      ${statusHtml}
      <h4>Listing Details</h4>
      <ul class="meta-list">
        ${metaHtml}
        <li><i class="fas fa-phone"></i><div><span class="mlabel">Questions?</span><a href="tel:${PHONE_LINK}" style="color:var(--yellow-dark);">${PHONE}</a></div></li>
      </ul>
      <p style="font-size:12px;color:var(--text-light);margin:12px 0 16px;font-style:italic;">Listed by ${esc(agentName)}</p>
      <a href="/contact-us/" class="btn-bid" style="margin-bottom:10px;">Schedule a Showing &rarr;</a>
      <a href="${esc(typeInfo.backLink)}" class="btn-all">&larr; ${esc(typeInfo.backLabel)}</a>
    </div>`;
}

// ── Property Features ────────────────────────────────────────────────────────
function renderFeatures(listing) {
  const d = listing.details || {};
  const features = [];
  if (d.heating) features.push({ icon: 'fa-fire', label: 'Heating', val: d.heating });
  if (d.airConditioning) features.push({ icon: 'fa-snowflake', label: 'Cooling', val: d.airConditioning });
  if (d.flooringType) features.push({ icon: 'fa-border-all', label: 'Flooring', val: d.flooringType });
  if (d.roofMaterial) features.push({ icon: 'fa-home', label: 'Roof', val: d.roofMaterial });
  if (d.exteriorConstruction1) features.push({ icon: 'fa-building', label: 'Exterior', val: d.exteriorConstruction1 });
  if (d.numGarageSpaces) features.push({ icon: 'fa-car', label: 'Garage', val: `${d.numGarageSpaces} space(s)` });
  if (d.numParkingSpaces) features.push({ icon: 'fa-parking', label: 'Parking', val: `${d.numParkingSpaces} spaces` });
  if (d.waterSource) features.push({ icon: 'fa-tint', label: 'Water', val: d.waterSource });
  if (d.sewer) features.push({ icon: 'fa-recycle', label: 'Sewer', val: d.sewer });
  if ((listing.nearby && listing.nearby.amenities || []).length) {
    features.push({ icon: 'fa-star', label: 'Nearby', val: listing.nearby.amenities.join(', ') });
  }
  if (!features.length) return '';
  const items = features.map(f =>
    `<li><i class="fas ${f.icon}"></i><div><span class="mlabel">${f.label}</span>${esc(String(f.val))}</div></li>`
  ).join('\n        ');
  return `
  <div class="desc-section" style="margin-top:24px;">
    <h3 class="desc-section-title"><i class="fas fa-list-ul"></i> Property Features</h3>
    <ul class="meta-list" style="margin:0;">
      ${items}
    </ul>
  </div>`;
}

// ── Full Page HTML ────────────────────────────────────────────────────────────
function buildPage(listing, typeInfo, slug) {
  const addr = listing.address;
  const fullAddr = fullAddress(addr);
  const d = listing.details || {};
  const lot = listing.lot || {};
  const price = formatPrice(listing.listPrice);
  const agent = (listing.agents || [])[0] || {};
  const agentName = agent.name || 'Sundgren Realty';

  // SEO title
  const beds = d.numBedrooms ? `${d.numBedrooms}BD` : '';
  const baths = d.numBathrooms ? `${d.numBathrooms}BA` : '';
  const specs = [beds, baths].filter(Boolean).join('/');
  const acreLabel = lot.acres && parseFloat(lot.acres) > 1 ? `${parseFloat(lot.acres).toFixed(1)} Acres` : '';
  const specsLabel = [specs, acreLabel].filter(Boolean).join(' ');
  const titleSuffix = specsLabel ? ` – ${specsLabel}` : '';
  const pageTitle = `${fullAddr}${titleSuffix} | ${SITE_NAME}`;
  const metaDesc = truncate(`${typeInfo.label} property at ${fullAddr}. ${d.description || ''}`, 158);
  const canonicalUrl = `${SITE_DOMAIN}/listings/${typeInfo.dir}/${slug}/`;
  const heroImg = listing.images && listing.images.length ? imgUrl(listing.images[0]) : '';
  const ogImg   = heroImg || `${SITE_DOMAIN}/images/og-image.jpg`;

  const photoGrid   = renderPhotoGrid(listing.images || []);
  const descHtml    = renderDescription(d.description || '');
  const featuresHtml = renderFeatures(listing);
  const infoCard    = renderInfoCard(listing, typeInfo);

  // Breadcrumb
  const breadcrumb = `
  <div class="container" style="padding-top:12px;padding-bottom:4px;">
    <nav aria-label="Breadcrumb" style="font-size:13px;color:var(--text-light);">
      <a href="/" style="color:var(--yellow-dark);">Home</a>
      <span style="margin:0 6px;">/</span>
      <a href="${typeInfo.backLink}" style="color:var(--yellow-dark);">${typeInfo.label}</a>
      <span style="margin:0 6px;">/</span>
      <span>${esc(addr.streetNumber)} ${esc(addr.streetName)}</span>
    </nav>
  </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(metaDesc)}">
  <link rel="canonical" href="${esc(canonicalUrl)}">
  <link rel="icon" href="/images/favicon-black.png" type="image/png" media="(prefers-color-scheme: light)">
  <link rel="icon" href="/images/favicon.png" type="image/png" media="(prefers-color-scheme: dark)">
  <link rel="apple-touch-icon" href="/images/favicon.png">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(metaDesc)}">
  <meta property="og:image" content="${esc(ogImg)}">
  <meta property="og:url" content="${esc(canonicalUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(SITE_NAME)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(pageTitle)}">
  <meta name="twitter:description" content="${esc(metaDesc)}">
  <meta name="twitter:image" content="${esc(ogImg)}">
  <meta name="robots" content="noindex, nofollow">
  <!-- SCHEMA:BreadcrumbList -->
  <!-- SCHEMA:WebPage -->
  <link rel="stylesheet" href="/css/sundgren.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
<!-- HEADER -->

${breadcrumb}

<!-- Hero -->
<section class="auction-hero" style="${heroImg ? `background-image:url('${esc(heroImg)}');` : 'background:#1a1a1a;'}">
  <div class="auction-hero-overlay"></div>
  <div class="auction-hero-content">
    <div class="auction-hero-meta">
      <span class="${statusPillClass(listing.status)} pill">${statusLabel(listing.status)}</span>
      <span class="pill" style="background:rgba(255,255,255,.15);color:#fff;">${esc(typeInfo.label)}</span>
    </div>
    <h1 class="auction-hero-title">${esc(fullAddr)}</h1>
    <p class="auction-hero-sub">${esc(price)}${specsLabel ? ' &nbsp;·&nbsp; ' + esc(specsLabel) : ''}</p>
  </div>
</section>

<!-- Main Content -->
<main class="section">
  <div class="container">
    <div class="auction-layout">

      <!-- Left Column -->
      <div class="auction-main">

        ${photoGrid}

        <div style="margin-top:${photoGrid ? '32px' : '0'};">
          ${descHtml}
          ${featuresHtml}
        </div>

        <!-- Disclaimer -->
        <p style="font-size:12px;color:var(--text-light);line-height:1.7;margin-top:32px;border-top:1px solid var(--border);padding-top:16px;">
          MLS# ${esc(listing.mlsNumber)}. Listed by ${esc(agentName)} with ${esc(SITE_NAME)}. Data provided by SCKMLS. All information deemed reliable but not guaranteed and should be independently verified. Subject to prior sale, change, or withdrawal.
        </p>
      </div>

      <!-- Right Column (Sidebar) -->
      <aside class="auction-sidebar">
        ${infoCard}
      </aside>

    </div>
  </div>
</main>

<!-- CTA -->
<section class="section section-dark" style="padding:48px 0;text-align:center;">
  <div class="container">
    <h2 style="font-size:24px;font-weight:800;color:#fff;margin:0 0 12px;">Ready to See This Property?</h2>
    <p style="font-size:16px;color:rgba(255,255,255,.75);margin:0 0 24px;">Contact our team and we'll schedule a showing at your convenience.</p>
    <a href="/contact-us/" class="btn-bid" style="font-size:16px;padding:14px 32px;">Contact Sundgren Realty &rarr;</a>
  </div>
</section>

<!-- FOOTER -->
</body>
</html>`;
}

// ── Fetch Listings from Repliers ──────────────────────────────────────────────
async function fetchListings() {
  // Fetch 9 sample listings (3 per type)
  // When real SCKMLS data is available, add: &class=CommercialProperty etc.
  const url = `${REPLIERS_API_URL}?resultsPerPage=9&status=A`;
  console.log(`  Fetching: ${url}`);
  const res = await fetch(url, {
    headers: { 'REPLIERS-API-KEY': REPLIERS_API_KEY }
  });
  if (!res.ok) throw new Error(`Repliers API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  console.log(`  Repliers: ${data.count} total listings, using ${data.listings.length}`);
  return data.listings;
}

// ── Write Page ────────────────────────────────────────────────────────────────
function writePage(html, dirSegments) {
  if (DIRECT_MODE) {
    const dir = path.join(DIST_DIR, ...dirSegments);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
    console.log(`    [dist] /${dirSegments.join('/')}/`);
  } else {
    const dir = path.join(LISTINGS_DIR, ...dirSegments);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
    console.log(`    [src]  listings/${dirSegments.join('/')}/`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🏠 Generating Repliers listing pages...');
  console.log(`  Mode: ${DIRECT_MODE ? 'DIRECT (writes to dist/)' : 'SOURCE (writes to listings/, run build.js after)'}`);

  const listings = await fetchListings();

  // Track index data for each type
  const index = { commercial: [], residential: [], land: [] };

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    const typeInfo = TYPE_MAP[i] || TYPE_MAP[TYPE_MAP.length - 1];
    const slug = buildListingSlug(listing);

    console.log(`\n  [${i+1}/9] ${listing.mlsNumber} → ${typeInfo.type}/${slug}`);

    const html = buildPage(listing, typeInfo, slug);
    writePage(html, [typeInfo.dir, slug]);

    index[typeInfo.type].push({
      slug,
      mlsNumber: listing.mlsNumber,
      address: fullAddress(listing.address),
      price: listing.listPrice,
      beds: listing.details.numBedrooms,
      baths: listing.details.numBathrooms,
      sqft: listing.details.sqft,
      acres: listing.lot ? listing.lot.acres : null,
      status: listing.status,
      image: listing.images && listing.images.length ? imgUrl(listing.images[0]) : '',
      style: listing.details.style || '',
    });
  }

  // Write index data for use by future index page generator
  const dataDir = path.join(__dirname, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'repliers-listings.json'), JSON.stringify(index, null, 2), 'utf8');
  console.log('\n  📄 Wrote data/repliers-listings.json');

  console.log('\n✅ Done. Listing pages generated:');
  Object.entries(index).forEach(([type, items]) => {
    console.log(`   ${type}: ${items.length} pages`);
    items.forEach(l => console.log(`     /listings/${type}/${l.slug}/`));
  });
  if (!DIRECT_MODE) {
    console.log('\n  Next: run `node build.js` to assemble into dist/');
  }
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
