/**
 * generate-listing-index-pages.mjs
 * 
 * Rebuilds:
 *   1. listings/index.html — all Sundgren listings as a card grid
 *   2. commercial.html — replaces IDX iframe with commercial listing cards
 *   3. residential.html — replaces IDX iframe with residential listing cards
 *
 * Data sources:
 *   - data/sundgren-listings-full.json (41 residential)
 *   - COMMERCIAL_LISTINGS constant below (3 commercial, not in JSON)
 *   - HANDBUILT constant below (hand-built pages not in JSON)
 *
 * Run: node generate-listing-index-pages.mjs
 */

import fs from 'fs';

// ── DATA ─────────────────────────────────────────────────────────────────────

const residentialListings = JSON.parse(
  fs.readFileSync('./data/sundgren-listings-full.json', 'utf8')
);

const COMMERCIAL_LISTINGS = [
  {
    listingId: '669041',
    address: '219 S Haverhill Rd, El Dorado, KS 67042',
    street: '219 S Haverhill Rd',
    city: 'El Dorado',
    zip: '67042',
    price: '99000',
    status: 'Active',
    sqft: '3220',
    acres: '0.73',
    beds: '',
    baths: '',
    agent: 'Audrey',
    photoUrl: 'https://s3.amazonaws.com/mlsphotos.idxbroker.com/photos/f7b7/7b7f8a0db7bcd1d8259ffb5f5bb4891b/c147',
    type: 'commercial',
    slug: '219-s-haverhill-rd-el-dorado-ks',
  },
  {
    listingId: '660706',
    address: '117 W 2nd Ave, El Dorado, KS 67042',
    street: '117 W 2nd Ave',
    city: 'El Dorado',
    zip: '67042',
    price: '90000',
    status: 'Active',
    sqft: '560',
    acres: '0.11',
    beds: '',
    baths: '',
    agent: 'Ashleigh',
    photoUrl: 'https://s3.amazonaws.com/mlsphotos.idxbroker.com/photos/4b95/59b4f649e6eb880ed5a9a9a5c1c37f06/c147',
    type: 'commercial',
    slug: '117-w-2nd-ave-el-dorado-ks',
  },
  {
    listingId: '635999',
    address: '4774 W Maple, Wichita, KS 67209',
    street: '4774 W Maple',
    city: 'Wichita',
    zip: '67209',
    price: '68000',
    status: 'Active',
    sqft: '15056',
    acres: '0.35',
    beds: '',
    baths: '',
    agent: 'Steven',
    photoUrl: 'https://s3.amazonaws.com/mlsphotos.idxbroker.com/photos/e451/154e57d57fcb6fb051c34e5d3fd5a767/c147',
    type: 'commercial',
    slug: '4774-w-maple-wichita-ks',
  },
];

const HANDBUILT_LISTINGS = [
  {
    listingId: '672300',
    address: '5747 SW 20th St, El Dorado, KS 67042',
    street: '5747 SW 20th St',
    city: 'El Dorado',
    zip: '67042',
    price: '1650000',
    status: 'Active',
    sqft: '5467',
    acres: '10',
    beds: '4',
    baths: '4',
    agent: 'Deanne',
    photoUrl: 'https://s3.amazonaws.com/mlsphotos.idxbroker.com/photos/15c4/4c51959f20c51f8fcc45064c0fa1e175/c147',
    type: 'residential',
    slug: '5747-sw-20th-el-dorado-ks-4bed-10acres',
  },
  {
    listingId: '676431',
    address: '10608 SW 90th St, Augusta, KS 67010',
    street: '10608 SW 90th St',
    city: 'Augusta',
    zip: '67010',
    price: '750000',
    status: 'Active',
    sqft: '2904',
    acres: '14.2',
    beds: '4',
    baths: '3',
    agent: 'Deanne',
    photoUrl: 'https://s3.amazonaws.com/mlsphotos.idxbroker.com/photos/e28e/e82e570e0389bb905b15622e837ca8be/c147',
    type: 'residential',
    slug: '10608-sw-90th-augusta-ks-4bed-14acres',
  },
  {
    listingId: 'land001',
    address: '10th St, Severy, KS 67137',
    street: '10th St',
    city: 'Severy',
    zip: '67137',
    price: '675000',
    status: 'Active',
    sqft: '',
    acres: '189.22',
    beds: '',
    baths: '',
    agent: 'Sundgren',
    photoUrl: '/images/hero-aerial.jpg',
    type: 'land',
    slug: '0000-10th-st-severy-ks-189acres-land',
  },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────

function fmtPrice(p) {
  if (!p || p === '0') return 'Contact for Price';
  return '$' + parseInt(p).toLocaleString();
}

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 80);
}

function getSlug(l) {
  if (l.slug) return l.slug;
  const parts = (l.address || '').split(',');
  const street = parts[0] ? slugify(parts[0]) : 'listing';
  const city = parts[1] ? slugify(parts[1].trim()) : '';
  return `${street}-${city}-ks`.substring(0, 80);
}

function listingCardHtml(l) {
  const slug = getSlug(l);
  const price = fmtPrice(l.price);
  const photo = l.photoUrl || '/images/og-preview.png';
  const addrParts = l.address.split(',');
  const city = addrParts[1] ? addrParts[1].trim() : l.city || '';
  const state = 'KS';
  const statusBg = (l.status || 'Active').toLowerCase() === 'active' ? '#22c55e' : '#f59e0b';

  const metaLine1 = [
    l.beds ? `<i class="fas fa-bed"></i>${l.beds} Beds` : '',
    l.baths ? `${l.baths} Baths` : '',
    l.sqft ? `${parseInt(l.sqft).toLocaleString()} sq ft` : '',
  ].filter(Boolean).join(' &bull; ');

  const metaLine2 = l.acres && parseFloat(l.acres) > 0
    ? `<i class="fas fa-expand-arrows-alt"></i>${l.acres} Acres`
    : '';

  const typeLabel = l.type === 'commercial' ? 'Commercial' : l.type === 'land' ? 'Land' : '';

  return `
        <a href="/listings/${slug}/" class="listing-card">
          <img class="listing-card-img"
               src="${photo}"
               alt="${l.address}"
               loading="lazy">
          <div class="listing-card-body">
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
              <span class="listing-card-badge" style="background:${statusBg};">${l.status || 'Active'}</span>
              ${typeLabel ? `<span class="listing-card-badge" style="background:var(--dark);">${typeLabel}</span>` : ''}
            </div>
            <p class="listing-card-address">${l.address}</p>
            ${metaLine1 ? `<p class="listing-card-meta">${metaLine1}</p>` : ''}
            ${metaLine2 ? `<p class="listing-card-meta">${metaLine2}</p>` : ''}
            <p class="listing-card-meta"><i class="fas fa-map-marker-alt"></i>${city}, ${state}</p>
            <p class="listing-card-price">${price}</p>
            <span class="listing-card-more">View Details &rarr;</span>
          </div>
        </a>`;
}

// ── CARD GRID CSS (shared) ────────────────────────────────────────────────────

const CARD_CSS = `
  <style>
    .listing-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }
    @media (max-width: 900px) { .listing-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 580px) { .listing-grid { grid-template-columns: 1fr; } }
    .listing-card {
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
      transition: transform .2s, box-shadow .2s;
    }
    .listing-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,.13); }
    .listing-card-img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; }
    .listing-card-body { padding: 18px 20px 20px; flex: 1; display: flex; flex-direction: column; }
    .listing-card-badge { display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #fff; border-radius: 4px; padding: 3px 8px; width: fit-content; }
    .listing-card-address { font-size: 15px; font-weight: 800; color: var(--dark); margin: 0 0 8px; line-height: 1.3; }
    .listing-card-meta { font-size: 13px; color: var(--text-light); margin: 0 0 4px; display: flex; align-items: center; gap: 6px; }
    .listing-card-meta i { color: var(--yellow-dark); font-size: 12px; }
    .listing-card-price { font-size: 20px; font-weight: 900; color: var(--dark); margin: 12px 0 0; }
    .listing-card-more { display: inline-block; margin-top: 14px; font-size: 13px; font-weight: 700; color: var(--red); }
  </style>`;

// ── 1. LISTINGS/INDEX.HTML ────────────────────────────────────────────────────

function buildListingsIndex() {
  // Combine all listings: handbuilt first (featured), then residential from JSON, then commercial
  // De-dupe by listingId
  const seen = new Set();
  const all = [];

  for (const l of [...HANDBUILT_LISTINGS, ...residentialListings, ...COMMERCIAL_LISTINGS]) {
    const id = l.listingId || getSlug(l);
    if (!seen.has(id)) {
      seen.add(id);
      all.push(l);
    }
  }

  const cards = all.map(listingCardHtml).join('');
  const count = all.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Property Listings | Sundgren Realty &amp; Auction | El Dorado, KS</title>
  <meta name="description" content="Browse active property listings from Sundgren Realty &amp; Auction in South Central Kansas. Homes, acreage, land, and commercial properties in Butler County and surrounding areas.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://sundgrenrealty.com/listings/">
  <meta property="og:title" content="Property Listings | Sundgren Realty &amp; Auction">
  <meta property="og:description" content="Active residential, land, and commercial listings from Sundgren Realty agents in South Central Kansas.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://sundgrenrealty.com/listings/">
  <meta property="og:image" content="/images/og-preview.png">
  <link rel="icon" href="/images/favicon-black.png" type="image/png" media="(prefers-color-scheme: light)">
  <link rel="icon" href="/images/favicon.png" type="image/png" media="(prefers-color-scheme: dark)">
  <link rel="apple-touch-icon" href="/images/favicon.png">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="/css/sundgren.css">
  ${CARD_CSS}
</head>
<body>

<!-- HEADER -->

<main>

  <section class="page-hero">
    <div class="inner">
      <h1>Property Listings</h1>
      <nav aria-label="Breadcrumb">
        <ol class="breadcrumb">
          <li><a href="/">Home</a></li>
          <li class="active">Listings</li>
        </ol>
      </nav>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-title">
        <span class="eyebrow">Active Listings</span>
        <h2>Properties Listed by Sundgren Realty</h2>
        <hr class="divider">
        <p>Showing ${count} active properties listed directly by Sundgren Realty agents across South Central Kansas. Residential, commercial, and land.</p>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px;">
        <a href="/listings/" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;padding:8px 16px;border-radius:6px;background:var(--dark);color:#fff;text-decoration:none;">All (${count})</a>
        <a href="/residential/" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;padding:8px 16px;border-radius:6px;background:var(--bg-light);color:var(--dark);text-decoration:none;border:1px solid var(--border);">Residential</a>
        <a href="/commercial/" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;padding:8px 16px;border-radius:6px;background:var(--bg-light);color:var(--dark);text-decoration:none;border:1px solid var(--border);">Commercial</a>
        <a href="/land-listings/" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;padding:8px 16px;border-radius:6px;background:var(--bg-light);color:var(--dark);text-decoration:none;border:1px solid var(--border);">Land</a>
      </div>
      <div class="listing-grid">
        ${cards}
      </div>
    </div>
  </section>

  <section class="cta-dark">
    <div class="container">
      <h2>Don't See What You're Looking For?</h2>
      <p>Search the full MLS or reach out to a Sundgren agent directly — we know South Central Kansas real estate inside and out.</p>
      <a href="/property-search/" class="btn-yellow">Search All MLS Listings</a>
      <a href="/contact-us/" class="btn-outline-white">Contact Our Team</a>
    </div>
  </section>

</main>

<!-- FOOTER -->

</body>
</html>`;
}

// ── 2. COMMERCIAL.HTML ────────────────────────────────────────────────────────

function buildCommercialPage() {
  const cards = COMMERCIAL_LISTINGS.map(listingCardHtml).join('');

  // Read existing commercial.html and replace from <!-- Featured Listings --> through the IDX script
  let html = fs.readFileSync('./commercial.html', 'utf8');

  const newSection = `<!-- Listings Grid -->
  <section class="section">
    <div class="container">
      <div class="section-title">
        <span class="eyebrow">Agent Listings</span>
        <h2>Sundgren Commercial Listings</h2>
        <hr class="divider">
        <p>Active commercial properties listed directly by Sundgren Realty agents in South Central Kansas.</p>
      </div>
      ${CARD_CSS}
      <div class="listing-grid">
        ${cards}
      </div>
    </div>
  </section>`;

  // Remove the old Featured Listings section through end of IDX script tag
  const featStart = html.indexOf('  <!-- Featured Listings -->');
  const idxEnd = html.indexOf('</script>', html.indexOf('loadIdxWidget')) + '</script>'.length;

  if (featStart < 0 || idxEnd < 0) {
    console.error('Could not find replacement markers in commercial.html');
    return null;
  }

  html = html.substring(0, featStart) + newSection + '\n\n' + html.substring(idxEnd);

  // Also remove the idx-widget-wrap style from <head>
  html = html.replace(/\s*\.idx-widget-wrap[^}]+\}\s*/g, '');

  return html;
}

// ── 3. RESIDENTIAL.HTML ───────────────────────────────────────────────────────

function buildResidentialPage() {
  // All residential + handbuilt residential, de-duped
  const seen = new Set();
  const resListings = [];
  for (const l of [...HANDBUILT_LISTINGS.filter(l => l.type === 'residential'), ...residentialListings]) {
    const id = l.listingId || getSlug(l);
    if (!seen.has(id)) {
      seen.add(id);
      resListings.push(l);
    }
  }

  const cards = resListings.map(listingCardHtml).join('');
  const count = resListings.length;

  let html = fs.readFileSync('./residential.html', 'utf8');

  const newSection = `<!-- Listings Grid -->
  <section class="section">
    <div class="container">
      <div class="section-title">
        <span class="eyebrow">Agent Listings</span>
        <h2>Sundgren Residential Listings</h2>
        <hr class="divider">
        <p>Showing ${count} active residential properties listed directly by Sundgren Realty agents across South Central Kansas.</p>
      </div>
      ${CARD_CSS}
      <div class="listing-grid">
        ${cards}
      </div>
    </div>
  </section>`;

  // Find the IDX widget section in residential.html - look for the script or idx-widget div
  const idxScriptStart = html.indexOf('(function(){');
  // Walk back to find the opening <script> tag
  let scriptTagStart = html.lastIndexOf('<script', idxScriptStart);
  const idxScriptEnd = html.indexOf('</script>', idxScriptStart) + '</script>'.length;

  // Also look for a preceding container div or section
  const sectionBeforeScript = html.lastIndexOf('<section', scriptTagStart);
  const divBeforeScript = html.lastIndexOf('<div', scriptTagStart);

  // Find the enclosing section/div that contains the widget
  // Strategy: look for idx-widget-wrap or a section wrapping the script
  const widgetWrapStart = html.lastIndexOf('idx-widget-wrap', idxScriptStart);
  let replaceStart, replaceEnd;

  if (widgetWrapStart > 0) {
    // Find the opening tag before widget-wrap class
    replaceStart = html.lastIndexOf('<', widgetWrapStart);
    replaceEnd = idxScriptEnd;
    // Close the wrapping div/section
    const closingDiv = html.indexOf('</div>', replaceEnd);
    const closingSection = html.indexOf('</section>', replaceEnd);
    replaceEnd = Math.min(
      closingDiv > 0 ? closingDiv + '</div>'.length : Infinity,
      closingSection > 0 ? closingSection + '</section>'.length : Infinity
    );
  } else {
    // Just replace from the script tag through end of script
    replaceStart = scriptTagStart;
    replaceEnd = idxScriptEnd;
  }

  if (replaceStart < 0 || replaceEnd <= replaceStart) {
    // Fallback: insert before cta-dark section
    const ctaStart = html.indexOf('  <section class="cta-dark"');
    if (ctaStart > 0) {
      html = html.substring(0, ctaStart) + newSection + '\n\n' + html.substring(ctaStart);
    } else {
      console.error('Could not find insertion point in residential.html');
      return null;
    }
  } else {
    html = html.substring(0, replaceStart) + newSection + '\n\n' + html.substring(replaceEnd);
  }

  // Clean up idx-widget-wrap style
  html = html.replace(/\s*\.idx-widget-wrap[^}]+\}\s*/g, '');

  return html;
}

// ── WRITE FILES ───────────────────────────────────────────────────────────────

// 1. listings/index.html
const listingsHtml = buildListingsIndex();
fs.writeFileSync('./listings/index.html', listingsHtml, 'utf8');
console.log(`✓ listings/index.html — ${[...new Set([...HANDBUILT_LISTINGS, ...residentialListings, ...COMMERCIAL_LISTINGS].map(l => l.listingId))].length} listings`);

// 2. commercial.html
const commercialHtml = buildCommercialPage();
if (commercialHtml) {
  fs.writeFileSync('./commercial.html', commercialHtml, 'utf8');
  console.log(`✓ commercial.html — ${COMMERCIAL_LISTINGS.length} listings`);
} else {
  console.log('✗ commercial.html — failed, manual fix needed');
}

// 3. residential.html
const residentialHtml = buildResidentialPage();
if (residentialHtml) {
  fs.writeFileSync('./residential.html', residentialHtml, 'utf8');
  const rCount = [...new Set([...HANDBUILT_LISTINGS.filter(l=>l.type==='residential'), ...residentialListings].map(l=>l.listingId))].length;
  console.log(`✓ residential.html — ${rCount} listings`);
} else {
  console.log('✗ residential.html — failed, manual fix needed');
}

console.log('\nDone. Run: node build.js && deploy');
