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

const allJson     = path.join(__dirname, 'data/all-listings.json');
const repliersJson = path.join(__dirname, 'data/repliers-listings.json');
const listings    = JSON.parse(fs.readFileSync(fs.existsSync(allJson) ? allJson : repliersJson, 'utf8'));

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function price(p) {
  return p && p > 0 ? '$' + parseInt(p).toLocaleString() : 'Contact for Price';
}
function metaLine(l) {
  if (l.beds) {
    let s = l.beds + ' Bd';
    if (l.baths) s += ' &bull; ' + l.baths + ' Ba';
    if (l.sqft)  s += ' &bull; ' + parseInt(l.sqft).toLocaleString() + ' sq ft';
    if (l.acres) s += ' &bull; ' + parseFloat(l.acres).toFixed(1) + ' Acres';
    return s;
  }
  if (l.acres) return parseFloat(l.acres).toFixed(1) + ' Acres';
  return l.style || '';
}
function typeColor(t) {
  return t === 'residential' ? '#0ea5e9' : t === 'land' ? '#16a34a' : '#6366f1';
}
function labelCap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
function streetOnly(addr) { return addr.split(',')[0]; }
function statusLabel(l) {
  if (l.status === 'A') return 'Active';
  const ls = (l.lastStatus || '').toLowerCase();
  if (ls === 'sc' || ls === 'cs') return 'Pending';
  return 'Inactive';
}
function statusColor(l) {
  const s = statusLabel(l);
  if (s === 'Active')  return '#22c55e';
  if (s === 'Pending') return '#2563eb';
  return '#6b7280';
}
function cityOf(l) {
  return l.city || (l.address ? l.address.split(',')[1] : '') || '';
}

// Cards with data-* attributes for client-side filter/search
const cards = listings.map(l => {
  const meta     = metaLine(l);
  const icon     = l.beds ? 'fa-bed' : 'fa-map';
  const sl       = statusLabel(l);
  const sc       = statusColor(l);
  const tc       = typeColor(l.type);
  const typeDisp = labelCap(l.type);
  const city     = cityOf(l).trim();
  const addrStr  = streetOnly(l.address);
  const priceStr = price(l.price);
  return `        <a href="/listings/${l.type}/${l.slug}/"
           class="listing-card${l.isSundgren ? ' listing-card--sundgren' : ''}"
           data-status="${sl.toLowerCase()}"
           data-type="${l.type}"
           data-city="${esc(city.toLowerCase())}"
           data-search="${esc((addrStr + ' ' + city + ' ' + priceStr + ' ' + typeDisp + ' ' + sl).toLowerCase())}">
          <img class="listing-card-img" src="${esc(l.image)}" alt="${esc(addrStr)}" loading="lazy">
          <div class="listing-card-body">
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
              <span class="listing-card-badge" style="background:${sc};">${sl}</span>
              <span class="listing-card-badge" style="background:${tc};">${typeDisp}</span>
            </div>
            <p class="listing-card-address">${esc(addrStr)}</p>
            <p class="listing-card-meta"><i class="fas ${icon}"></i>${meta}</p>
            ${city ? `<p class="listing-card-meta"><i class="fas fa-map-marker-alt"></i>${esc(city)}, KS</p>` : ''}
            <p class="listing-card-price">${priceStr}</p>
            <span class="listing-card-more">View Details &rarr;</span>
          </div>
        </a>`;
}).join('\n');

// Map pins
const pinsJs = listings
  .filter(l => l.lat && l.lng)
  .map(l => {
    const addrShort = streetOnly(l.address) + ', ' + cityOf(l).trim() + ', ' + (l.state || 'KS');
    return `{lat:${l.lat},lng:${l.lng},addr:"${esc(addrShort)}",price:"${esc(price(l.price))}",url:"/listings/${l.type}/${l.slug}/",color:"${typeColor(l.type)}"}`;
  }).join(',\n            ');

// Autocomplete suggestions — clean readable strings only
const suggestions = [...new Set(
  listings.flatMap(l => [
    streetOnly(l.address),
    cityOf(l).trim(),
    statusLabel(l),
    labelCap(l.type),
  ]).filter(v => {
    if (!v) return false;
    if (/^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+/i.test(v)) return false;
    if (v.includes('&amp;') || v.includes('&lt;')) return false;
    return true;
  })
)].sort();

const total       = listings.length;
const residential = listings.filter(l => l.type === 'residential').length;
const land        = listings.filter(l => l.type === 'land').length;
const subhead     = `${total} active South Central Kansas MLS listings - ${residential} residential, ${land} land.`;

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
  <style>
    .listing-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-bottom: 28px;
    }
    .listing-search-wrap {
      position: relative;
      flex: 1;
      min-width: 220px;
      max-width: 400px;
    }
    .listing-search-wrap i {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: #aaa;
      font-size: 14px;
      pointer-events: none;
    }
    #listing-search {
      width: 100%;
      padding: 10px 14px 10px 38px;
      border: 1.5px solid var(--border);
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      background: #fff;
      box-sizing: border-box;
      transition: border-color .2s;
    }
    #listing-search:focus { border-color: var(--yellow-dark); }
    #search-autocomplete {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: #fff;
      border: 1.5px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,.12);
      z-index: 200;
      overflow: hidden;
      display: none;
    }
    #search-autocomplete li {
      list-style: none;
      padding: 10px 16px;
      font-size: 14px;
      cursor: pointer;
      transition: background .1s;
    }
    #search-autocomplete li:hover,
    #search-autocomplete li.active { background: #fef9ec; }
    #search-autocomplete li mark {
      background: none;
      color: var(--yellow-dark);
      font-weight: 800;
    }
    .filter-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .filter-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 999px;
      border: 1.5px solid var(--border);
      background: #fff;
      font-size: 13px;
      font-weight: 700;
      color: var(--dark);
      cursor: pointer;
      transition: background .15s, border-color .15s, color .15s;
      white-space: nowrap;
      user-select: none;
    }
    .filter-pill:hover { border-color: var(--yellow-dark); }
    .filter-pill.active {
      background: var(--dark);
      color: #fff;
      border-color: var(--dark);
    }
    .filter-pill .pill-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .listing-results-count {
      font-size: 13px;
      color: var(--text-light);
      margin-bottom: 20px;
    }
    .listing-results-count strong { color: var(--dark); }
    #no-results {
      display: none;
      text-align: center;
      padding: 60px 20px;
      color: var(--text-light);
      font-size: 15px;
    }
    #no-results i { font-size: 32px; display:block; margin-bottom:12px; color: #ccc; }
  </style>
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

      <p style="font-size:15px;color:var(--text-light);margin-bottom:24px;">${subhead}</p>

      <!-- Search + Filter Toolbar -->
      <div class="listing-toolbar">
        <div class="listing-search-wrap">
          <i class="fas fa-search"></i>
          <input id="listing-search" type="text" placeholder="Search by address, city, or type…" autocomplete="off" aria-label="Search listings">
          <ul id="search-autocomplete" role="listbox"></ul>
        </div>
        <div class="filter-pills" role="group" aria-label="Filter listings">
          <button class="filter-pill active" data-filter="all">All <span id="pill-count-all"></span></button>
          <button class="filter-pill" data-filter="active">
            <span class="pill-dot" style="background:#22c55e;"></span>Active <span id="pill-count-active"></span>
          </button>
          <button class="filter-pill" data-filter="pending">
            <span class="pill-dot" style="background:#2563eb;"></span>Pending <span id="pill-count-pending"></span>
          </button>
          <button class="filter-pill" data-filter="residential">
            <span class="pill-dot" style="background:#0ea5e9;"></span>Residential <span id="pill-count-residential"></span>
          </button>
          <button class="filter-pill" data-filter="land">
            <span class="pill-dot" style="background:#22c55e;"></span>Land <span id="pill-count-land"></span>
          </button>
        </div>
      </div>

      <p class="listing-results-count" id="results-count"></p>

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
          var listings = [${pinsJs}];
          var bounds = [];
          var map = L.map('listings-map',{scrollWheelZoom:false});
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(map);
          listings.forEach(function(l){
            bounds.push([l.lat,l.lng]);
            var icon = L.divIcon({className:'',html:'<div style="width:14px;height:14px;border-radius:50%;background:'+l.color+';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>',iconSize:[14,14],iconAnchor:[7,7]});
            L.marker([l.lat,l.lng],{icon:icon}).addTo(map)
              .bindPopup('<div style="min-width:180px;"><strong>'+l.addr+'</strong><br><strong style="font-size:16px;">'+l.price+'</strong><br><a href="'+l.url+'" style="color:#b7791f;font-weight:700;font-size:13px;">View Details &rarr;<\/a><\/div>');
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
        <div class="listing-grid" id="listing-grid" style="margin-bottom:48px;">
${cards}
        </div>
        <div id="no-results">
          <i class="fas fa-search"></i>
          No listings match your search. <a href="#" onclick="clearFilters();return false;" style="color:var(--yellow-dark);font-weight:700;">Clear filters</a>
        </div>
      </div>

    </div>
  </section>

</main>

<!-- FOOTER -->

<script>
document.addEventListener('DOMContentLoaded', function(){
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  var SUGGESTIONS = ${JSON.stringify(suggestions)};

  var searchInput = document.getElementById('listing-search');
  var acList      = document.getElementById('search-autocomplete');
  var cards       = Array.from(document.querySelectorAll('.listing-card'));
  var countEl     = document.getElementById('results-count');
  var noResults   = document.getElementById('no-results');
  var grid        = document.getElementById('listing-grid');
  var pills       = Array.from(document.querySelectorAll('.filter-pill'));

  var activeFilter = 'all';
  var activeSearch = '';
  var acActiveIdx  = -1;

  function updatePillCounts() {
    ['all','active','pending','residential','land'].forEach(function(f) {
      var el = document.getElementById('pill-count-' + f);
      if (!el) return;
      var n = cards.filter(function(c) {
        if (f === 'all') return true;
        return c.dataset.status === f || c.dataset.type === f;
      }).length;
      el.textContent = '(' + n + ')';
    });
  }

  function applyFilters() {
    var q = activeSearch.trim().toLowerCase();
    var visible = 0;
    cards.forEach(function(c) {
      var matchFilter = activeFilter === 'all' || c.dataset.status === activeFilter || c.dataset.type === activeFilter;
      var matchSearch = !q || c.dataset.search.indexOf(q) !== -1;
      var show = matchFilter && matchSearch;
      c.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    countEl.innerHTML = '<strong>' + visible + '</strong> listing' + (visible !== 1 ? 's' : '') + ' shown';
    noResults.style.display = visible === 0 ? 'block' : 'none';
    grid.style.display = visible === 0 ? 'none' : '';
  }

  pills.forEach(function(pill) {
    pill.addEventListener('click', function() {
      pills.forEach(function(p) { p.classList.remove('active'); });
      pill.classList.add('active');
      activeFilter = pill.dataset.filter;
      applyFilters();
    });
  });

  searchInput.addEventListener('input', function() {
    activeSearch = searchInput.value;
    applyFilters();
    showAutocomplete(searchInput.value);
  });

  searchInput.addEventListener('keydown', function(e) {
    var items = acList.querySelectorAll('li');
    if (e.key === 'ArrowDown') {
      acActiveIdx = Math.min(acActiveIdx + 1, items.length - 1);
      updateAcActive(items); e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      acActiveIdx = Math.max(acActiveIdx - 1, -1);
      updateAcActive(items); e.preventDefault();
    } else if (e.key === 'Enter' && acActiveIdx >= 0 && items[acActiveIdx]) {
      selectSuggestion(items[acActiveIdx].dataset.value); e.preventDefault();
    } else if (e.key === 'Escape') {
      hideAutocomplete();
    }
  });

  function updateAcActive(items) {
    items.forEach(function(li, i) { li.classList.toggle('active', i === acActiveIdx); });
  }

  function showAutocomplete(q) {
    acActiveIdx = -1;
    if (!q || q.length < 2) { hideAutocomplete(); return; }
    var ql = q.toLowerCase();
    var matches = SUGGESTIONS.filter(function(s) {
      return s.toLowerCase().indexOf(ql) !== -1;
    }).slice(0, 7);
    if (!matches.length) { hideAutocomplete(); return; }
    acList.innerHTML = matches.map(function(m) {
      var li2 = m.toLowerCase().indexOf(ql);
      var highlighted = li2 >= 0
        ? m.slice(0, li2) + '<mark>' + m.slice(li2, li2 + ql.length) + '</mark>' + m.slice(li2 + ql.length)
        : m;
      return '<li data-value="' + esc(m) + '">' + highlighted + '</li>';
    }).join('');
    acList.querySelectorAll('li').forEach(function(li) {
      li.addEventListener('mousedown', function(e) {
        e.preventDefault();
        selectSuggestion(li.dataset.value);
      });
    });
    acList.style.display = 'block';
  }

  function hideAutocomplete() {
    acList.style.display = 'none';
    acList.innerHTML = '';
    acActiveIdx = -1;
  }

  function selectSuggestion(val) {
    searchInput.value = val;
    activeSearch = val;
    hideAutocomplete();
    applyFilters();
  }

  document.addEventListener('click', function(e) {
    if (!searchInput.contains(e.target) && !acList.contains(e.target)) hideAutocomplete();
  });

  window.clearFilters = function() {
    searchInput.value = '';
    activeSearch = '';
    activeFilter = 'all';
    pills.forEach(function(p) { p.classList.remove('active'); });
    document.querySelector('[data-filter="all"]').classList.add('active');
    applyFilters();
    hideAutocomplete();
  };

  updatePillCounts();
  applyFilters();
});
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'listings/index.html'), html, 'utf8');
console.log('Done. listings/index.html rebuilt with', total, 'listings.');
