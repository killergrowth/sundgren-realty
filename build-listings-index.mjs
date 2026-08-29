/**
 * build-listings-index.mjs
 * Rebuilds listings/index.html from real Repliers data in data/repliers-listings.json
 * Run: node build-listings-index.mjs
 * Then: node build.js && wrangler deploy
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const listings = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/repliers-listings.json'), 'utf8'));

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function price(p) {
  return p && p > 0 ? '$' + parseInt(p).toLocaleString() : 'Bid to Buy';
}
function metaLine(l) {
  if (l.beds) {
    let s = l.beds + ' Bd';
    if (l.baths) s += ' &bull; ' + l.baths + ' Ba';
    if (l.sqft) s += ' &bull; ' + parseInt(l.sqft).toLocaleString() + ' sq ft';
    return s;
  }
  if (l.acres) return parseFloat(l.acres).toFixed(1) + ' Acres';
  return l.style || '';
}
function badgeColor(t) {
  return t === 'residential' ? '#0ea5e9' : t === 'land' ? '#16a34a' : '#6366f1';
}
function labelCap(t) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function streetOnly(addr) {
  return addr.split(',')[0];
}

// Map pins
const pinItems = listings
  .filter(l => l.lat && l.lng)
  .map(l => {
    const addrShort = streetOnly(l.address) + ', ' + l.city + ', ' + l.state;
    return `{lat:${l.lat},lng:${l.lng},addr:"${esc(addrShort)}",price:"${esc(price(l.price))}",url:"/listings/${l.type}/${l.slug}/",badge:"${labelCap(l.type)}"}`;
  });
const pinsJs = pinItems.join(',\n            ');

// Listing cards
const cards = listings.map(l => {
  const meta = metaLine(l);
  const icon = l.beds ? 'fa-bed' : 'fa-map';
  return `        <a href="/listings/${l.type}/${l.slug}/" class="listing-card">
          <img class="listing-card-img" src="${esc(l.image)}" alt="${esc(streetOnly(l.address))}" loading="lazy">
          <div class="listing-card-body">
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
              <span class="listing-card-badge" style="background:#22c55e;">Active</span>
              <span class="listing-card-badge" style="background:${badgeColor(l.type)}">${labelCap(l.type)}</span>
            </div>
            <p class="listing-card-address">${esc(streetOnly(l.address))}</p>
            <p class="listing-card-meta"><i class="fas ${icon}"></i>${meta}</p>
            <p class="listing-card-price">${price(l.price)}</p>
            <span class="listing-card-more">View Details &rarr;</span>
          </div>
        </a>`;
}).join('\n');

const total = listings.length;
const residential = listings.filter(l => l.type === 'residential').length;
const land = listings.filter(l => l.type === 'land').length;
const subhead = `${total} active properties listed by Jeremy Sundgren in South Central Kansas — ${residential} residential, ${land} land.`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Property Listings | Sundgren Realty &amp; Auction | El Dorado, KS</title>
  <meta name="description" content="Browse active property listings from Sundgren Realty &amp; Auction in South Central Kansas. Homes, acreage, land, and commercial properties in Butler County and surrounding areas.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://sundgrenrealty.com/listings/">
  <meta property="og:title" content="Property Listings | Sundgren Realty &amp; Auction">
  <meta property="og:description" content="Active residential and land listings from Jeremy Sundgren in South Central Kansas.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://sundgrenrealty.com/listings/">
  <meta property="og:image" content="/images/og-preview.png">
  <link rel="icon" href="/images/favicon-black.png" type="image/png" media="(prefers-color-scheme: light)">
  <link rel="icon" href="/images/favicon.png" type="image/png" media="(prefers-color-scheme: dark)">
  <link rel="apple-touch-icon" href="/images/favicon.png">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="/css/sundgren.css">
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
        <p>${subhead}</p>
      </div>

      <!-- View Toggle -->
      <div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-bottom:24px;">
        <button id="view-grid-btn" onclick="setView('grid')" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;padding:8px 14px;border-radius:6px;border:2px solid var(--dark);background:var(--dark);color:#fff;cursor:pointer;">
          <i class="fas fa-th"></i> Grid
        </button>
        <button id="view-map-btn" onclick="setView('map')" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;padding:8px 14px;border-radius:6px;border:2px solid var(--border);background:#fff;color:var(--dark);cursor:pointer;">
          <i class="fas fa-map-marked-alt"></i> Map
        </button>
      </div>

      <!-- Map View -->
      <div id="listings-map-view" style="display:none;margin-bottom:48px;">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
        <div id="listings-map" style="height:520px;border-radius:12px;border:1px solid var(--border);overflow:hidden;"></div>
        <script>
        var _mapInitialized = false;
        function initListingsMap() {
          if (_mapInitialized) return;
          _mapInitialized = true;
          var listings = [
            ${pinsJs}
          ];
          var bounds = [];
          var map = L.map('listings-map',{scrollWheelZoom:false});
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(map);
          listings.forEach(function(l){
            bounds.push([l.lat,l.lng]);
            var color = l.badge==='Residential' ? '#0ea5e9' : l.badge==='Land' ? '#16a34a' : '#6366f1';
            var icon = L.divIcon({className:'',html:'<div style="width:14px;height:14px;border-radius:50%;background:'+color+';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>',iconSize:[14,14],iconAnchor:[7,7]});
            L.marker([l.lat,l.lng],{icon:icon}).addTo(map)
              .bindPopup('<div style="min-width:180px;"><strong>'+l.addr+'</strong><br><span style="font-size:13px;color:#555;">'+l.badge+'</span><br><strong style="font-size:16px;">'+l.price+'</strong><br><a href="'+l.url+'" style="color:#b7791f;font-weight:700;font-size:13px;">View Details &rarr;<\/a><\/div>');
          });
          if (bounds.length) map.fitBounds(bounds, {padding:[40,40]});
        }
        function setView(v) {
          var grid = document.getElementById('listings-grid-view');
          var mapEl = document.getElementById('listings-map-view');
          var gb = document.getElementById('view-grid-btn');
          var mb = document.getElementById('view-map-btn');
          if (v==='map') {
            grid.style.display='none'; mapEl.style.display='block';
            gb.style.background='#fff'; gb.style.color='var(--dark)'; gb.style.borderColor='var(--border)';
            mb.style.background='var(--dark)'; mb.style.color='#fff'; mb.style.borderColor='var(--dark)';
            initListingsMap();
          } else {
            mapEl.style.display='none'; grid.style.display='block';
            mb.style.background='#fff'; mb.style.color='var(--dark)'; mb.style.borderColor='var(--border)';
            gb.style.background='var(--dark)'; gb.style.color='#fff'; gb.style.borderColor='var(--dark)';
          }
        }
        <\/script>
      </div>

      <!-- Grid View -->
      <div id="listings-grid-view">
        <div class="listing-grid" style="margin-bottom:48px;">
${cards}
        </div>
      </div>

    </div>
  </section>

</main>

<!-- FOOTER -->
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'listings/index.html'), html, 'utf8');
console.log('Done. listings/index.html rebuilt with', total, 'real listings.');
