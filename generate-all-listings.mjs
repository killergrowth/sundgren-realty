/**
 * generate-all-listings.mjs — Sundgren Realty full listing build
 *
 * Pulls listings from Repliers across target counties/price filters,
 * skips any MLS numbers already in data/built-listings.json (dedup),
 * generates individual listing pages, and updates the manifest.
 *
 * Filters:
 *   Butler, Harvey, Cowley, Marion — $150K+
 *   Sedgwick                       — $750K+
 *
 * Run: node generate-all-listings.mjs
 * Then: node build-listings-index.mjs && node build-type-index-pages.mjs && node build.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPLIERS_API_KEY = process.env.REPLIERS_API_KEY || '';
const REPLIERS_API_URL = 'https://api.repliers.io/listings';
const SITE_NAME = 'Sundgren Realty & Auction';
const PHONE = '(316) 321-7112';
const EMAIL = 'realty@sundgren.com';
const PAGE_SIZE = 50;

// County filters
const COUNTY_FILTERS = [
  { area: 'Butler',   minPrice: 100000 },
  { area: 'Harvey',   minPrice: 100000 },
  { area: 'Cowley',   minPrice: 100000 },
  { area: 'Marion',   minPrice: 1      },
  { area: 'Sedgwick', minPrice: 600000 },
];

// ── Dedup manifest ─────────────────────────────────────────────────────────────
const MANIFEST_PATH = path.join(__dirname, 'data/built-listings.json');

function loadManifest() {
  if (fs.existsSync(MANIFEST_PATH)) {
    try { return new Set(JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))); }
    catch { return new Set(); }
  }
  return new Set();
}

function saveManifest(set) {
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify([...set].sort(), null, 2), 'utf8');
}

// ── Classification ─────────────────────────────────────────────────────────────
const LAND_TYPES = new Set(['land','farm','unimproved land','vacant land/acreage','vacant land','acreage','lot']);
const COMMERCIAL_TYPES = new Set(['commercial','office','retail','industrial','multi-family','mixed use']);

function classifyListing(listing) {
  const propType = ((listing.details && listing.details.propertyType) || '').toLowerCase().trim();
  const style    = ((listing.details && listing.details.style)        || '').toLowerCase().trim();
  if (COMMERCIAL_TYPES.has(propType) || COMMERCIAL_TYPES.has(style)) {
    return { type: 'commercial', label: 'Commercial', dir: 'commercial', backLink: '/commercial/', backLabel: 'All Commercial' };
  }
  if (LAND_TYPES.has(propType) || LAND_TYPES.has(style)) {
    return { type: 'land', label: 'Land', dir: 'land', backLink: '/listings/land/', backLabel: 'All Land' };
  }
  return { type: 'residential', label: 'Residential', dir: 'residential', backLink: '/listings/residential/', backLabel: 'All Residential' };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function slugify(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-').substring(0, 70);
}
function imgUrl(img) {
  if (!img) return '';
  return img.startsWith('http') ? img : `https://cdn.repliers.io/${img}`;
}
function fullAddress(addr) {
  const parts = [
    [addr.streetNumber, addr.streetName, addr.streetSuffix].filter(Boolean).join(' '),
    addr.city, addr.state, addr.zip
  ].filter(Boolean);
  return parts.join(', ');
}
function buildSlug(listing) {
  const addr = listing.address;
  const street = [addr.streetNumber, addr.streetName, addr.streetSuffix].filter(Boolean).join(' ');
  const base = `${street} ${addr.city} ${addr.state || 'KS'}`;
  return slugify(base) + '-' + listing.mlsNumber;
}
function fmtPrice(p) {
  return p && p > 0 ? '$' + parseInt(p).toLocaleString() : 'Contact for Price';
}
function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Fetch all pages for one county filter ─────────────────────────────────────
async function fetchCounty(area, minPrice) {
  const all = [];
  let page = 1;
  let numPages = 1;
  while (page <= numPages) {
    const url = `${REPLIERS_API_URL}?status=A&area=${encodeURIComponent(area)}&minPrice=${minPrice}&resultsPerPage=${PAGE_SIZE}&pageNum=${page}`;
    const res = await fetch(url, { headers: { 'REPLIERS-API-KEY': REPLIERS_API_KEY } });
    if (!res.ok) throw new Error(`Repliers ${area} p${page}: ${res.status}`);
    const data = await res.json();
    numPages = data.numPages || 1;
    (data.listings || []).forEach(l => all.push(l));
    console.log(`    ${area} p${page}/${numPages} — ${all.length} fetched`);
    page++;
  }
  return all;
}

// ── Build one listing page ─────────────────────────────────────────────────────
function buildPage(listing, typeInfo, slug) {
  const addr = listing.address;
  const det  = listing.details || {};
  const street = [addr.streetNumber, addr.streetName, addr.streetSuffix].filter(Boolean).join(' ');
  const city   = addr.city || '';
  const state  = addr.state || 'KS';
  const zip    = addr.zip || '';
  const fullAddr = fullAddress(addr);
  const price  = fmtPrice(listing.listPrice);
  const status = listing.status === 'A' ? 'Active' : listing.status === 'U' ? 'Under Contract' : listing.status;
  const beds   = det.numBedrooms;
  const baths  = det.numBathrooms;
  const sqft   = det.sqft ? parseInt(det.sqft).toLocaleString() : null;
  const acres  = listing.lot && listing.lot.acres ? parseFloat(listing.lot.acres) : null;
  const style  = det.style || '';
  const desc   = stripHtml(det.description || '').replace(/\*\*\*\* SAMPLE DATA \*\*\*\*/g, '').trim();
  const year   = det.numRooms ? '' : (det.yearBuilt || '');
  const images = (listing.images || []).map(imgUrl).filter(Boolean);
  const heroImg = images[0] || '/images/og-preview.png';
  const agents  = listing.agents || [];
  const agent   = agents[0] || {};
  const agentName  = agent.name || 'Jeremy Sundgren';
  const agentPhone = (agent.phones || [])[0] || PHONE;
  const mlsNum  = listing.mlsNumber;
  const lat     = listing.map ? listing.map.latitude  : null;
  const lng     = listing.map ? listing.map.longitude : null;

  const typeBadgeColor = typeInfo.type === 'residential' ? '#0ea5e9' : typeInfo.type === 'land' ? '#16a34a' : '#6366f1';
  const statusColor    = status === 'Active' ? '#22c55e' : '#f59e0b';

  // Stats row
  const stats = [];
  if (beds)  stats.push(`<div class="stat-item"><span class="stat-val">${beds}</span><span class="stat-lbl">Beds</span></div>`);
  if (baths) stats.push(`<div class="stat-item"><span class="stat-val">${baths}</span><span class="stat-lbl">Baths</span></div>`);
  if (sqft)  stats.push(`<div class="stat-item"><span class="stat-val">${sqft}</span><span class="stat-lbl">Sq Ft</span></div>`);
  if (acres) stats.push(`<div class="stat-item"><span class="stat-val">${acres % 1 === 0 ? acres : acres.toFixed(1)}</span><span class="stat-lbl">Acres</span></div>`);

  // Photo grid
  const photoGrid = images.length > 1 ? `
  <section class="listing-photos" style="margin:0 0 48px;">
    <div class="photo-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
      ${images.slice(0, 12).map((img, i) => `
      <div class="photo-item" style="border-radius:10px;overflow:hidden;aspect-ratio:4/3;cursor:pointer;" onclick="openLightbox(${i})">
        <img src="${esc(img)}" alt="${esc(street)} photo ${i+1}" loading="${i < 4 ? 'eager' : 'lazy'}" style="width:100%;height:100%;object-fit:cover;">
      </div>`).join('')}
    </div>
  </section>` : '';

  // Map section
  const mapSection = lat && lng ? `
  <section class="section" style="padding-top:0;">
    <div class="container">
      <h2 style="font-size:22px;margin-bottom:16px;">Location</h2>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
      <div id="listing-map" style="height:360px;border-radius:12px;border:1px solid var(--border);overflow:hidden;margin-bottom:48px;"></div>
      <script>
      (function(){
        var map = L.map('listing-map',{scrollWheelZoom:false}).setView([${lat},${lng}],14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(map);
        var icon = L.divIcon({className:'',html:'<div style="width:16px;height:16px;border-radius:50%;background:${typeBadgeColor};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);"></div>',iconSize:[16,16],iconAnchor:[8,8]});
        L.marker([${lat},${lng}],{icon:icon}).addTo(map).bindPopup('<strong>${esc(street)}</strong><br>${esc(price)}').openPopup();
      })();
      <\/script>
    </div>
  </section>` : '';

  // Lightbox
  const lightbox = images.length > 1 ? `
  <div id="lightbox" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;align-items:center;justify-content:center;" onclick="closeLightbox()">
    <button onclick="event.stopPropagation();moveLightbox(-1)" style="position:absolute;left:20px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.15);border:none;color:#fff;font-size:28px;width:48px;height:48px;border-radius:50%;cursor:pointer;">&#8249;</button>
    <img id="lb-img" src="" style="max-width:90vw;max-height:88vh;border-radius:8px;object-fit:contain;">
    <button onclick="event.stopPropagation();moveLightbox(1)" style="position:absolute;right:20px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.15);border:none;color:#fff;font-size:28px;width:48px;height:48px;border-radius:50%;cursor:pointer;">&#8250;</button>
    <button onclick="closeLightbox()" style="position:absolute;top:16px;right:20px;background:none;border:none;color:#fff;font-size:28px;cursor:pointer;">&#x2715;</button>
  </div>
  <script>
  var _imgs = ${JSON.stringify(images.slice(0, 12))};
  var _cur = 0;
  function openLightbox(i){ _cur=i; document.getElementById('lb-img').src=_imgs[i]; document.getElementById('lightbox').style.display='flex'; document.body.style.overflow='hidden'; }
  function closeLightbox(){ document.getElementById('lightbox').style.display='none'; document.body.style.overflow=''; }
  function moveLightbox(d){ _cur=(_cur+d+_imgs.length)%_imgs.length; document.getElementById('lb-img').src=_imgs[_cur]; }
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeLightbox(); if(e.key==='ArrowLeft') moveLightbox(-1); if(e.key==='ArrowRight') moveLightbox(1); });
  <\/script>` : '';

  const metaTitle   = `${street}, ${city}, ${state} – ${typeInfo.label} Listing | ${SITE_NAME}`;
  const metaDesc    = desc ? desc.substring(0, 155) : `${typeInfo.label} listing at ${fullAddr}. ${price}. Listed by ${agentName} with ${SITE_NAME}.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(metaTitle)}</title>
  <meta name="description" content="${esc(metaDesc)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://sundgrenrealty.com/listings/${typeInfo.dir}/${slug}/">
  <meta property="og:title" content="${esc(metaTitle)}">
  <meta property="og:description" content="${esc(metaDesc)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://sundgrenrealty.com/listings/${typeInfo.dir}/${slug}/">
  <meta property="og:image" content="${esc(heroImg)}">
  <link rel="icon" href="/images/favicon-black.png" type="image/png" media="(prefers-color-scheme: light)">
  <link rel="icon" href="/images/favicon.png" type="image/png" media="(prefers-color-scheme: dark)">
  <link rel="apple-touch-icon" href="/images/favicon.png">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="/css/sundgren.css">
  <style>
    .stat-item{text-align:center;padding:16px 20px;background:var(--light);border-radius:10px;}
    .stat-val{display:block;font-size:26px;font-weight:800;color:var(--dark);}
    .stat-lbl{display:block;font-size:12px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:.06em;margin-top:2px;}
    .detail-row{display:flex;gap:8px;padding:12px 0;border-bottom:1px solid var(--border);font-size:14px;}
    .detail-lbl{font-weight:700;min-width:140px;color:var(--text-light);}
    .detail-val{color:var(--dark);}
  </style>
</head>
<body>

<!-- HEADER -->

<main>

  <section class="page-hero" style="background-image:url('${esc(heroImg)}');background-size:cover;background-position:center;position:relative;min-height:420px;">
    <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.45) 0%,rgba(0,0,0,.65) 100%);"></div>
    <div class="inner" style="position:relative;z-index:1;">
      <nav aria-label="Breadcrumb" style="margin-bottom:16px;">
        <ol class="breadcrumb" style="color:rgba(255,255,255,.75);">
          <li><a href="/" style="color:rgba(255,255,255,.75);">Home</a></li>
          <li><a href="/listings/" style="color:rgba(255,255,255,.75);">Listings</a></li>
          <li><a href="/listings/${typeInfo.dir}/" style="color:rgba(255,255,255,.75);">${esc(typeInfo.label)}</a></li>
          <li class="active" style="color:#fff;">${esc(city)}</li>
        </ol>
      </nav>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <span style="background:${statusColor};color:#fff;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:4px 10px;border-radius:20px;">${esc(status)}</span>
        <span style="background:${typeBadgeColor};color:#fff;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:4px 10px;border-radius:20px;">${esc(typeInfo.label)}</span>
      </div>
      <h1 style="color:#fff;font-size:clamp(22px,4vw,38px);margin:0 0 10px;line-height:1.2;">${esc(street)}</h1>
      <p style="color:rgba(255,255,255,.9);font-size:18px;margin:0 0 16px;">${esc(city)}, ${esc(state)} ${esc(zip)}</p>
      <p style="color:#fff;font-size:32px;font-weight:800;margin:0;">${esc(price)}</p>
    </div>
  </section>

  <!-- Stats bar -->
  ${stats.length ? `<section style="background:#fff;border-bottom:1px solid var(--border);padding:24px 0;">
    <div class="container">
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
        ${stats.join('\n        ')}
      </div>
    </div>
  </section>` : ''}

  <!-- Photo grid -->
  ${photoGrid ? `<section class="section" style="padding-bottom:0;"><div class="container">${photoGrid}</div></section>` : ''}

  <!-- Main content -->
  <section class="section">
    <div class="container">
      <div style="display:grid;grid-template-columns:1fr 340px;gap:48px;align-items:start;">

        <!-- Left: description + details -->
        <div>
          ${desc ? `<h2 style="font-size:22px;margin-bottom:12px;">About This Property</h2>
          <p style="font-size:15px;line-height:1.75;color:var(--text);margin-bottom:36px;">${esc(desc)}</p>` : ''}

          <h2 style="font-size:22px;margin-bottom:16px;">Property Details</h2>
          <div style="margin-bottom:36px;">
            ${beds    ? `<div class="detail-row"><span class="detail-lbl">Bedrooms</span><span class="detail-val">${beds}</span></div>` : ''}
            ${baths   ? `<div class="detail-row"><span class="detail-lbl">Bathrooms</span><span class="detail-val">${baths}</span></div>` : ''}
            ${sqft    ? `<div class="detail-row"><span class="detail-lbl">Square Feet</span><span class="detail-val">${sqft}</span></div>` : ''}
            ${acres   ? `<div class="detail-row"><span class="detail-lbl">Acreage</span><span class="detail-val">${acres % 1 === 0 ? acres : acres.toFixed(2)} acres</span></div>` : ''}
            ${style   ? `<div class="detail-row"><span class="detail-lbl">Style</span><span class="detail-val">${esc(style)}</span></div>` : ''}
            ${year    ? `<div class="detail-row"><span class="detail-lbl">Year Built</span><span class="detail-val">${esc(year)}</span></div>` : ''}
            <div class="detail-row"><span class="detail-lbl">MLS Number</span><span class="detail-val">${esc(mlsNum)}</span></div>
            <div class="detail-row"><span class="detail-lbl">Status</span><span class="detail-val">${esc(status)}</span></div>
            <div class="detail-row"><span class="detail-lbl">Listed By</span><span class="detail-val">${esc(agentName)}</span></div>
          </div>
        </div>

        <!-- Right: contact card -->
        <div style="position:sticky;top:24px;">
          <div style="background:#fff;border:1px solid var(--border);border-radius:14px;padding:28px;box-shadow:0 4px 24px rgba(0,0,0,.07);">
            <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-light);margin:0 0 4px;">Listed By</p>
            <p style="font-size:20px;font-weight:800;color:var(--dark);margin:0 0 4px;">${esc(agentName)}</p>
            <p style="font-size:14px;color:var(--text-light);margin:0 0 20px;">${esc(SITE_NAME)}</p>
            <a href="tel:${esc(agentPhone.replace(/\D/g,''))}" style="display:block;background:var(--dark);color:#fff;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;margin-bottom:10px;"><i class="fas fa-phone" style="margin-right:8px;"></i>${esc(agentPhone)}</a>
            <a href="mailto:${esc(EMAIL)}" style="display:block;background:var(--accent);color:#fff;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;margin-bottom:20px;"><i class="fas fa-envelope" style="margin-right:8px;"></i>Email About This Property</a>
            <p style="font-size:11px;color:var(--text-light);text-align:center;margin:0;line-height:1.5;">MLS# ${esc(mlsNum)}. Listed by ${esc(agentName)} with ${esc(SITE_NAME)}. Data provided by South Central Kansas MLS.</p>
          </div>
        </div>

      </div>
    </div>
  </section>

  ${mapSection}

</main>

${lightbox}

<!-- FOOTER -->
</body>
</html>`;
}

// ── Write page to source ───────────────────────────────────────────────────────
function writePage(html, typeDir, slug) {
  const dir = path.join(__dirname, 'listings', typeDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🏠 Sundgren Realty — Full Listing Build');
  console.log('=========================================\n');

  if (!REPLIERS_API_KEY) { console.error('❌ REPLIERS_API_KEY not set'); process.exit(1); }

  const manifest = loadManifest();
  console.log(`📋 Manifest: ${manifest.size} previously built MLS numbers\n`);

  // Fetch all listings across county filters
  const seen = new Set(); // dedup within this run (same listing can appear in multiple county queries)
  const toProcess = [];

  for (const { area, minPrice } of COUNTY_FILTERS) {
    console.log(`📍 Fetching ${area} (min $${minPrice.toLocaleString()})...`);
    const listings = await fetchCounty(area, minPrice);
    let added = 0, skippedManifest = 0, skippedDupe = 0, skippedNoPhoto = 0;
    for (const l of listings) {
      if (!l.images || !l.images.length) { skippedNoPhoto++; continue; }
      if (seen.has(l.mlsNumber)) { skippedDupe++; continue; }
      seen.add(l.mlsNumber);
      if (manifest.has(l.mlsNumber)) { skippedManifest++; continue; }
      toProcess.push(l);
      added++;
    }
    console.log(`   ✅ ${added} new | ${skippedManifest} already built | ${skippedDupe} dupes | ${skippedNoPhoto} no photos\n`);
  }

  console.log(`\n🔨 Building ${toProcess.length} new listing pages...\n`);

  const indexData = { commercial: [], residential: [], land: [] };
  let built = 0, errors = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const listing = toProcess[i];
    try {
      const typeInfo = classifyListing(listing);
      const slug = buildSlug(listing);
      const html = buildPage(listing, typeInfo, slug);
      writePage(html, typeInfo.dir, slug);
      manifest.add(listing.mlsNumber);
      indexData[typeInfo.type].push({
        slug,
        mlsNumber: listing.mlsNumber,
        type: typeInfo.type,
        address: fullAddress(listing.address),
        city: listing.address.city || '',
        state: listing.address.state || 'KS',
        lat: listing.map ? listing.map.latitude : null,
        lng: listing.map ? listing.map.longitude : null,
        price: listing.listPrice,
        beds: listing.details.numBedrooms,
        baths: listing.details.numBathrooms,
        sqft: listing.details.sqft,
        acres: listing.lot ? listing.lot.acres : null,
        status: listing.status,
        image: imgUrl((listing.images || [])[0]),
        style: listing.details.style || '',
      });
      built++;
      if (built % 25 === 0) console.log(`   ... ${built}/${toProcess.length} built`);
    } catch (err) {
      console.error(`   ❌ ${listing.mlsNumber}: ${err.message}`);
      errors++;
    }
  }

  // Merge with previously built all-listings.json so index is always complete
  const prevAllJson = path.join(__dirname, 'data/all-listings.json');
  if (fs.existsSync(prevAllJson)) {
    const prev = JSON.parse(fs.readFileSync(prevAllJson, 'utf8'));
    const newMls = new Set(Object.values(indexData).flat().map(l => l.mlsNumber));
    prev.forEach(l => {
      if (!newMls.has(l.mlsNumber) && indexData[l.type]) {
        indexData[l.type].push(l);
      }
    });
  }
  // Also merge Jeremy's agent listings
  const repliersJson = path.join(__dirname, 'data/repliers-listings.json');
  if (fs.existsSync(repliersJson)) {
    const existing = JSON.parse(fs.readFileSync(repliersJson, 'utf8'));
    const allMls = new Set(Object.values(indexData).flat().map(l => l.mlsNumber));
    existing.forEach(l => {
      manifest.add(l.mlsNumber);
      if (indexData[l.type] && !allMls.has(l.mlsNumber)) {
        indexData[l.type].push(l);
      }
    });
  }

  // Save updated manifest
  saveManifest(manifest);
  console.log(`\n✅ Built: ${built} | Errors: ${errors}`);
  console.log(`📋 Manifest now: ${manifest.size} total MLS numbers\n`);

  // Write combined index JSON for index page builders
  const allListings = [...indexData.residential, ...indexData.land, ...indexData.commercial];
  fs.writeFileSync(path.join(__dirname, 'data/all-listings.json'), JSON.stringify(allListings, null, 2), 'utf8');
  console.log(`📄 Wrote data/all-listings.json — ${allListings.length} total listings`);
  console.log(`   Residential: ${indexData.residential.length}`);
  console.log(`   Land:        ${indexData.land.length}`);
  console.log(`   Commercial:  ${indexData.commercial.length}`);

  console.log('\nNext steps:');
  console.log('  node build-listings-index.mjs');
  console.log('  node build-type-index-pages.mjs');
  console.log('  node build.js');
}

main().catch(err => { console.error(err); process.exit(1); });
