/**
 * generate-repliers-listings.mjs - Sundgren Realty
 *
 * Fetches Jeremy Sundgren's active MLS listings via Repliers API and generates
 * individual detail pages under listings/{type}/{slug}/
 *
 * Pages use <!-- HEADER --> and <!-- FOOTER --> placeholders.
 * Run: REPLIERS_API_KEY=<key> node generate-repliers-listings.mjs
 * Then: node build.js
 *
 * Agent: Jeremy Sundgren | boardAgentId: SUNDGJER
 * Source: SCKMLS via Repliers API (agent=Jeremy+Sundgren)
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────
const REPLIERS_API_KEY = process.env.REPLIERS_API_KEY || process.env.REPLIERS_KEY;
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

// ── Classify listing type from Repliers propertyType field ──────────────────
// MLS property types for Jeremy's listings:
//   'Residential'        → residential
//   'Land'               → land
//   'Vacant Land/Acreage'→ land
//   'Farm'               → land
//   'Commercial Sale'    → commercial
//   anything else        → residential (safe default)
const LAND_TYPES = new Set(['land', 'farm', 'unimproved land', 'vacant land/acreage', 'vacant land', 'acreage']);
const COMMERCIAL_TYPES = new Set(['commercial sale', 'commercial', 'industrial', 'office']);

const TYPE_DEFS = {
  residential: { type: 'residential', label: 'Residential', dir: 'residential', backLink: '/residential/', backLabel: 'All Residential' },
  land:        { type: 'land',        label: 'Land',        dir: 'land',        backLink: '/land-listings/',  backLabel: 'All Land Listings' },
  commercial:  { type: 'commercial',  label: 'Commercial',  dir: 'commercial',  backLink: '/commercial/',     backLabel: 'All Commercial' },
};

function classifyListing(listing) {
  const propType = ((listing.details && listing.details.propertyType) || '').toLowerCase().trim();
  const style    = ((listing.details && listing.details.style)        || '').toLowerCase().trim();
  if (COMMERCIAL_TYPES.has(propType)) return TYPE_DEFS.commercial;
  if (LAND_TYPES.has(propType) || LAND_TYPES.has(style)) return TYPE_DEFS.land;
  return TYPE_DEFS.residential;
}

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
  if (d.basement)              features.push({ icon: 'fa-layer-group',   label: 'Basement',    val: d.basement });
  if (d.fireplace)             features.push({ icon: 'fa-fire-alt',      label: 'Fireplace',   val: d.fireplace });
  if (d.pool)                  features.push({ icon: 'fa-swimming-pool', label: 'Pool',        val: d.pool });
  if (!features.length) return '';
  const cells = features.map(f => `
    <div class="feat-cell">
      <i class="fas ${f.icon}"></i>
      <div><span class="mlabel">${f.label}</span>${esc(String(f.val))}</div>
    </div>`).join('');
  return `
  <div class="desc-section" style="margin-top:24px;">
    <h3 class="desc-section-title"><i class="fas fa-list-ul"></i> Property Features</h3>
    <div class="feat-grid">${cells}
    </div>
  </div>`;
}

// ── Similar Listings ────────────────────────────────────────────────────────
function renderSimilarListings(currentMls, allListings, typeInfo) {
  // Same type, exclude current, up to 3
  const similar = allListings
    .filter(l => l.mlsNumber !== currentMls && l.type === typeInfo.type)
    .slice(0, 3);
  if (!similar.length) {
    // Fall back to any other type if none of same type
    const fallback = allListings.filter(l => l.mlsNumber !== currentMls).slice(0, 3);
    if (!fallback.length) return '';
    similar.push(...fallback);
  }
  const typeBadgeColor = t => t === 'residential' ? '#0ea5e9' : t === 'land' ? '#16a34a' : '#6366f1';
  const cards = similar.map(l => {
    const priceStr = l.price ? '$' + parseInt(l.price).toLocaleString() : 'Contact for Price';
    const meta = l.beds ? `${l.beds} Bd · ${l.baths} Ba · ${parseInt(l.sqft||0).toLocaleString()} sq ft` :
                 l.acres ? `${parseFloat(l.acres).toFixed(2)} acres` : '';
    return `
      <a href="/listings/${l.type}/${l.slug}/" class="listing-card">
        <img class="listing-card-img" src="${esc(l.image)}" alt="${esc(l.address)}" loading="lazy">
        <div class="listing-card-body">
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
            <span class="listing-card-badge" style="background:#22c55e;">Active</span>
            <span class="listing-card-badge" style="background:${typeBadgeColor(l.type)};">${l.type.charAt(0).toUpperCase()+l.type.slice(1)}</span>
          </div>
          <p class="listing-card-address">${esc(l.address.split(',')[0])}</p>
          <p class="listing-card-meta"><i class="fas fa-map-marker-alt"></i>${esc(l.city)}, ${esc(l.state)}</p>
          ${meta ? `<p class="listing-card-meta"><i class="fas fa-ruler-combined"></i>${esc(meta)}</p>` : ''}
          <p class="listing-card-price">${priceStr}</p>
          <span class="listing-card-more">View Details &rarr;</span>
        </div>
      </a>`;
  }).join('');

  return `
<section class="section" style="padding:48px 0;background:var(--bg-light);">
  <div class="container">
    <div class="section-title" style="margin-bottom:32px;">
      <span class="eyebrow">More Like This</span>
      <h2 style="font-size:22px;">Similar ${typeInfo.label} Listings</h2>
      <hr class="divider">
    </div>
    <div class="listing-grid">
      ${cards}
    </div>
    <div style="text-align:center;margin-top:32px;">
      <a href="/listings/" class="btn-bid">View All Listings &rarr;</a>
    </div>
  </div>
</section>`;
}

// ── Map Embed ────────────────────────────────────────────────────────────────
function renderMap(listing) {
  const addr = listing.address;
  const lat = listing.map ? listing.map.latitude : null;
  const lng = listing.map ? listing.map.longitude : null;
  const fullAddr = `${addr.streetNumber || ''} ${addr.streetName || ''} ${addr.streetSuffix || ''}, ${addr.city || ''}, ${addr.state || ''} ${addr.zip || ''}`.trim();
  if (lat && lng) {
    return `
  <div class="desc-section" style="margin-top:24px;">
    <h3 class="desc-section-title"><i class="fas fa-map-marker-alt"></i> Location</h3>
    <div id="sg-map" style="height:300px;border-radius:10px;overflow:hidden;border:1px solid var(--border);"></div>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
    <script>
    (function(){
      var map = L.map('sg-map',{scrollWheelZoom:false}).setView([${lat},${lng}],15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'\u00a9 OpenStreetMap contributors',maxZoom:19}).addTo(map);
      L.marker([${lat},${lng}]).addTo(map).bindPopup('${esc(fullAddr)}').openPopup();
    })();
    <\/script>
  </div>`;
  } else {
    const q = encodeURIComponent(fullAddr);
    return `
  <div class="desc-section" style="margin-top:24px;">
    <h3 class="desc-section-title"><i class="fas fa-map-marker-alt"></i> Location</h3>
    <iframe
      src="https://www.openstreetmap.org/search?query=${q}"
      width="100%" height="300"
      style="border:none;border-radius:10px;border:1px solid var(--border);"
      loading="lazy" title="Property location map"
    ></iframe>
    <p style="font-size:12px;color:var(--text-light);margin-top:8px;"><i class="fas fa-map-marker-alt" style="color:var(--yellow-dark);"></i> ${esc(fullAddr)}</p>
  </div>`;
  }
}

// ── Stats Row (quick facts bar) ──────────────────────────────────────────────
function renderStatsRow(listing) {
  const d = listing.details || {};
  const lot = listing.lot || {};
  const stats = [];
  if (listing.listPrice)        stats.push({ icon: 'fa-tag',                label: 'List Price',     val: formatPrice(listing.listPrice) });
  if (d.numBedrooms)            stats.push({ icon: 'fa-bed',                label: 'Bedrooms',       val: d.numBedrooms });
  if (d.numBathrooms)           stats.push({ icon: 'fa-bath',               label: 'Bathrooms',      val: d.numBathrooms });
  if (d.sqft)                   stats.push({ icon: 'fa-ruler-combined',     label: 'Sq Ft',          val: parseInt(d.sqft).toLocaleString() });
  if (lot.acres)                stats.push({ icon: 'fa-expand-arrows-alt',  label: 'Lot Size',       val: `${parseFloat(lot.acres).toFixed(2)} ac` });
  if (d.yearBuilt)              stats.push({ icon: 'fa-calendar-alt',       label: 'Year Built',     val: d.yearBuilt });
  if (d.daysOnMarket != null)   stats.push({ icon: 'fa-clock',              label: 'Days on Market', val: d.daysOnMarket });
  if (!stats.length) return '';
  const cells = stats.map(s => `
    <div class="stat-cell">
      <i class="fas ${s.icon}"></i>
      <div class="stat-val">${esc(String(s.val))}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('');
  return `<div class="stat-row">${cells}
  </div>`;
}

// ── Full Page HTML ────────────────────────────────────────────────────────────
function buildPage(listing, typeInfo, slug, allListings) {
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

  const photoGrid    = renderPhotoGrid(listing.images || []);
  const descHtml     = renderDescription(d.description || '');
  const featuresHtml = renderFeatures(listing);
  const mapHtml      = renderMap(listing);
  const statsRow     = renderStatsRow(listing);
  const infoCard     = renderInfoCard(listing, typeInfo);
  const similarHtml  = renderSimilarListings(listing.mlsNumber, allListings || [], typeInfo);

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

        ${statsRow}

        <div style="margin-top:${photoGrid ? '32px' : '0'};">
          ${descHtml}
          ${featuresHtml}
          ${mapHtml}
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

${similarHtml}

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

// ── Fetch Jeremy Sundgren's listings from Repliers ───────────────────────────
async function fetchListings() {
  const url = `${REPLIERS_API_URL}?agent=Jeremy+Sundgren&status=A&resultsPerPage=50`;
  console.log(`  Fetching: ${url}`);
  const res = await fetch(url, {
    headers: { 'repliers-api-key': REPLIERS_API_KEY }
  });
  if (!res.ok) throw new Error(`Repliers API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (data.unrecognizedParams && data.unrecognizedParams.length) {
    console.warn('  ⚠️  Unrecognized params:', data.unrecognizedParams);
  }
  console.log(`  Repliers: ${data.count} Jeremy Sundgren listings found`);
  if (!data.listings || !data.listings.length) throw new Error('No listings returned — check agent name or API key');
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

  // First pass: classify all listings and build index summary
  for (const listing of listings) {
    const typeInfo = classifyListing(listing);
    const slug = buildListingSlug(listing);
    const propType = (listing.details && listing.details.propertyType) || '';
    console.log(`  classify: MLS ${listing.mlsNumber} — propType="${propType}" → ${typeInfo.type}`);
    index[typeInfo.type].push({
      slug,
      mlsNumber: listing.mlsNumber,
      type: typeInfo.type,
      address: fullAddress(listing.address),
      city: listing.address.city || '',
      state: listing.address.state || '',
      lat: listing.map ? (listing.map.latitude || null) : null,
      lng: listing.map ? (listing.map.longitude || null) : null,
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

  // Flatten all listings into one array for similar listings widget
  const allListings = Object.values(index).flat();

  // Second pass: build full pages now that we have all listing data
  console.log('\n  Building pages...');
  for (const listing of listings) {
    const typeInfo = classifyListing(listing);
    const slug = buildListingSlug(listing);
    console.log(`\n  MLS ${listing.mlsNumber} → ${typeInfo.type}/${slug}`);
    const html = buildPage(listing, typeInfo, slug, allListings);
    writePage(html, [typeInfo.dir, slug]);
  }

  // Write index data
  const dataDir = path.join(__dirname, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'repliers-listings.json'), JSON.stringify(allListings, null, 2), 'utf8');
  console.log('\n  📄 Wrote data/repliers-listings.json');

  console.log('\n✅ Done. Listing pages generated:');
  Object.entries(index).forEach(([type, items]) => {
    console.log(`   ${type}: ${items.length} pages`);
    items.forEach(l => console.log(`     /listings/${type}/${l.slug}/`));
  });
  console.log(`\n   Total: ${allListings.length} pages across ${Object.keys(index).filter(k => index[k].length).length} categories`);
  if (!DIRECT_MODE) {
    console.log('\n  Next: run `node build.js` to assemble into dist/');
  }
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
