/**
 * build-property-search.mjs
 * Builds property-search.html — same search+filter toolbar as /listings/
 * Run: node build-property-search.mjs
 * Then: node build.js && wrangler deploy
 */
import {
  esc, price, streetOnly, labelCap, cityOf, statusLabel, typeColor,
  buildCards, buildMapPins, buildSuggestions, buildFilterPills, buildFilterScript
} from './listing-card-helpers.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const allJson      = path.join(__dirname, 'data/all-listings.json');
const repliersJson = path.join(__dirname, 'data/repliers-listings.json');
const listings     = JSON.parse(fs.readFileSync(fs.existsSync(allJson) ? allJson : repliersJson, 'utf8'));

// Helpers imported from listing-card-helpers.mjs

const cards = buildCards(listings);

const pinsJs = buildMapPins(listings);

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

const total = listings.length;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Property Search | Sundgren Realty &amp; Auction | El Dorado, KS</title>
  <meta name="description" content="Search residential homes, land, and commercial real estate for sale in El Dorado, Butler County, and South Central Kansas.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://sundgrenrealty.com/property-search/">
  <meta property="og:title" content="Property Search | Sundgren Realty &amp; Auction">
  <meta property="og:description" content="Search active listings from Sundgren Realty across South Central Kansas.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://sundgrenrealty.com/property-search/">
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
      <h1>Property Search</h1>
      <nav aria-label="Breadcrumb">
        <ol class="breadcrumb">
          <li><a href="/">Home</a></li>
          <li class="active">Property Search</li>
        </ol>
      </nav>
    </div>
  </section>

  <section class="section">
    <div class="container">

      <p style="font-size:15px;color:var(--text-light);margin-bottom:24px;">${total} active listings from Sundgren Realty across South Central Kansas. Search by address, city, or type — or use the filters to narrow it down.</p>

      <!-- Search + Filter Toolbar -->
      <div class="listing-toolbar">
        <div class="listing-search-wrap">
          <i class="fas fa-search"></i>
          <input id="listing-search" type="text" placeholder="Search by address, city, or type…" autocomplete="off" aria-label="Search listings">
          <ul id="search-autocomplete" role="listbox"></ul>
        </div>
        <div class="filter-pills" role="group" aria-label="Filter listings">
${buildFilterPills(['all','active','pending','residential','land','price-reduced'])}
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

  <section class="cta-dark">
    <div class="container">
      <h2>Ready to Find Your Property?</h2>
      <p>Our experienced agents know South Central Kansas inside and out. Let us help you find the right property at the right price.</p>
      <a href="/contact-us/" class="btn-yellow">Talk to an Agent</a>
      <a href="/listings/" class="btn-outline-white">Browse All Listings</a>
    </div>
  </section>

</main>

<!-- FOOTER -->

<script>
window._listingSuggestions = ${JSON.stringify(suggestions)};
document.addEventListener('DOMContentLoaded', function(){

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

  var PAGE_SIZE = 100;
  var currentPage = 1;

  function updatePillCounts() {
    ['all','active','pending','residential','land','price-reduced'].forEach(function(f) {
      var el = document.getElementById('pill-count-' + f);
      if (!el) return;
      var n = cards.filter(function(c) {
        if (f === 'all') return true;
        if (f === 'price-reduced') return c.dataset.reduced === 'true';
        return c.dataset.status === f || c.dataset.type === f;
      }).length;
      el.textContent = '(' + n + ')';
    });
  }

  function renderPagination(matchedCards) {
    var existing = document.getElementById('listings-pagination');
    if (existing) existing.remove();
    var totalPages = Math.ceil(matchedCards.length / PAGE_SIZE);
    if (totalPages <= 1) return;
    var pag = document.createElement('div');
    pag.id = 'listings-pagination';
    pag.style.cssText = 'display:flex;justify-content:center;align-items:center;gap:8px;margin:32px 0 48px;flex-wrap:wrap;';
    function makeBtn(label, page, active) {
      var b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'padding:8px 14px;border-radius:6px;border:2px solid ' + (active ? 'var(--dark)' : 'var(--border)') + ';background:' + (active ? 'var(--dark)' : '#fff') + ';color:' + (active ? '#fff' : 'var(--dark)') + ';font-weight:700;font-size:13px;cursor:' + (page === null ? 'default' : 'pointer') + ';';
      if (page !== null) b.addEventListener('click', function() { currentPage = page; applyFilters(); window.scrollTo({top:0,behavior:'smooth'}); });
      return b;
    }
    var start = Math.max(1, currentPage - 2);
    var end   = Math.min(totalPages, currentPage + 2);
    if (currentPage > 1) pag.appendChild(makeBtn('← Prev', currentPage - 1, false));
    if (start > 1) { pag.appendChild(makeBtn('1', 1, false)); if (start > 2) pag.appendChild(makeBtn('…', null, false)); }
    for (var p = start; p <= end; p++) pag.appendChild(makeBtn(String(p), p, p === currentPage));
    if (end < totalPages) { if (end < totalPages - 1) pag.appendChild(makeBtn('…', null, false)); pag.appendChild(makeBtn(String(totalPages), totalPages, false)); }
    if (currentPage < totalPages) pag.appendChild(makeBtn('Next →', currentPage + 1, false));
    grid.parentNode.insertBefore(pag, grid.nextSibling);
  }

  function applyFilters() {
    var q = activeSearch.trim().toLowerCase();
    var matched = [];
    cards.forEach(function(c) {
      var matchFilter = activeFilter === 'all'
        || c.dataset.status === activeFilter
        || c.dataset.type === activeFilter
        || (activeFilter === 'price-reduced' && c.dataset.reduced === 'true');
      var matchSearch = !q || c.dataset.search.indexOf(q) !== -1;
      if (matchFilter && matchSearch) matched.push(c);
      c.style.display = 'none';
    });
    var startIdx = (currentPage - 1) * PAGE_SIZE;
    matched.slice(startIdx, startIdx + PAGE_SIZE).forEach(function(c) { c.style.display = ''; });
    var visible = matched.length;
    countEl.innerHTML = '<strong>' + visible + '</strong> listing' + (visible !== 1 ? 's' : '') + ' shown';
    noResults.style.display = visible === 0 ? 'block' : 'none';
    grid.style.display = visible === 0 ? 'none' : '';
    renderPagination(matched);
  }

  pills.forEach(function(pill) {
    pill.addEventListener('click', function() {
      pills.forEach(function(p) { p.classList.remove('active'); });
      pill.classList.add('active');
      activeFilter = pill.dataset.filter;
      currentPage = 1;
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

fs.writeFileSync(path.join(__dirname, 'property-search.html'), html, 'utf8');
console.log('Done. property-search.html rebuilt with', total, 'listings.');
