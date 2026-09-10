/**
 * listing-card-helpers.mjs
 * Shared helpers for all listing grid build scripts.
 * Imported by: build-listings-index.mjs, build-type-index-pages.mjs, build-property-search.mjs
 *
 * Single source of truth for:
 *  - Card HTML (with price-reduced badge, strikethrough, data-reduced attr)
 *  - Status logic (Active / Pending / Inactive)
 *  - Filter pill HTML + JS filter/count logic
 *  - Autocomplete suggestion builder
 *  - Map pin builder
 */

export function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function price(p) {
  return p && p > 0 ? '$' + parseInt(p).toLocaleString() : 'Contact for Price';
}

export function metaLine(l) {
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

export function typeColor(t) {
  return t === 'residential' ? '#0ea5e9' : t === 'land' ? '#16a34a' : '#6366f1';
}

export function labelCap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
export function streetOnly(addr) { return addr.split(',')[0]; }

export function statusLabel(l) {
  if (l.status === 'A') return 'Active';
  const ls = (l.lastStatus || '').toLowerCase();
  if (ls === 'sc' || ls === 'cs' || ls === 'lc') return 'Pending';
  return 'Inactive';
}

export function statusColor(l) {
  const s = statusLabel(l);
  if (s === 'Active')  return '#22c55e';
  if (s === 'Pending') return '#2563eb';
  return '#6b7280';
}

export function cityOf(l) {
  return l.city || (l.address ? l.address.split(',')[1] : '') || '';
}

export function isPriceReduced(l) {
  return !!(l.previousPrice && l.previousPrice > l.price && l.price > 0);
}

/** Build a single listing card <a> element */
export function buildCard(l, { sundgrenClass = true } = {}) {
  const icon      = l.beds ? 'fa-bed' : 'fa-map';
  const sl        = statusLabel(l);
  const sc        = statusColor(l);
  const tc        = typeColor(l.type);
  const typeDisp  = labelCap(l.type);
  const city      = cityOf(l).trim();
  const addrStr   = streetOnly(l.address);
  const priceStr  = price(l.price);
  const reduced   = isPriceReduced(l);
  const priceHtml = reduced
    ? `<p class="listing-card-price"><span style="text-decoration:line-through;color:#9ca3af;font-size:0.85em;margin-right:6px;">${price(l.previousPrice)}</span>${priceStr}</p>`
    : `<p class="listing-card-price">${priceStr}</p>`;
  const sundgrenAttr = sundgrenClass && l.isSundgren ? ' listing-card--sundgren' : '';

  return `        <a href="/listings/${l.type}/${l.slug}/"
           class="listing-card${sundgrenAttr}"
           data-status="${sl.toLowerCase()}"
           data-type="${l.type}"
           data-city="${esc(city.toLowerCase())}"
           data-reduced="${reduced ? 'true' : 'false'}"
           data-search="${esc((addrStr + ' ' + city + ' ' + priceStr + ' ' + typeDisp + ' ' + sl).toLowerCase())}">
          <img class="listing-card-img" src="${esc(l.image)}" alt="${esc(addrStr)}" loading="lazy">
          <div class="listing-card-body">
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
              <span class="listing-card-badge" style="background:${sc};">${sl}</span>
              <span class="listing-card-badge" style="background:${tc};">${typeDisp}</span>
              ${reduced ? '<span class="listing-card-badge" style="background:#f59e0b;">Price Reduced</span>' : ''}
            </div>
            <p class="listing-card-address">${esc(addrStr)}</p>
            <p class="listing-card-meta"><i class="fas ${icon}"></i>${metaLine(l)}</p>
            ${city ? `<p class="listing-card-meta"><i class="fas fa-map-marker-alt"></i>${esc(city)}, KS</p>` : ''}
            ${priceHtml}
            <span class="listing-card-more">View Details &rarr;</span>
          </div>
        </a>`;
}

export function buildCards(listings, opts) {
  return listings.map(l => buildCard(l, opts)).join('\n');
}

export function buildMapPins(listings) {
  return listings
    .filter(l => l.lat && l.lng)
    .map(l => {
      const addrShort = streetOnly(l.address) + ', ' + cityOf(l).trim() + ', ' + (l.state || 'KS');
      return `{lat:${l.lat},lng:${l.lng},addr:"${esc(addrShort)}",price:"${esc(price(l.price))}",url:"/listings/${l.type}/${l.slug}/",color:"${typeColor(l.type)}"}`;
    }).join(',\n            ');
}

export function buildSuggestions(listings) {
  return [...new Set(
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
}

/**
 * Filter pills HTML — pass the set of pills you want.
 * defaults: all, active, pending, residential, land, sundgren, price-reduced
 */
export function buildFilterPills(pills = ['all','active','pending','residential','land','sundgren','price-reduced']) {
  const defs = {
    'all':           { label: 'All',           dot: null,                      style: '' },
    'active':        { label: 'Active',         dot: '#22c55e',                 style: '' },
    'pending':       { label: 'Pending',        dot: '#2563eb',                 style: '' },
    'residential':   { label: 'Residential',    dot: '#0ea5e9',                 style: '' },
    'land':          { label: 'Land',           dot: '#16a34a',                 style: '' },
    'commercial':    { label: 'Commercial',     dot: '#6366f1',                 style: '' },
    'sundgren':      { label: 'Sundgren Only',  dot: 'rgba(212,175,55,.9)',     style: 'border-color:rgba(212,175,55,.6);' },
    'price-reduced': { label: 'Price Reduced',  dot: '#f59e0b',                 style: 'border-color:rgba(245,158,11,.6);' },
  };
  return pills.map(key => {
    const d = defs[key] || { label: key, dot: null, style: '' };
    const dotHtml = d.dot ? `<span class="pill-dot" style="background:${d.dot};"></span>` : '';
    const active  = key === 'all' ? ' active' : '';
    const style   = d.style ? ` style="${d.style}"` : '';
    return `          <button class="filter-pill${active}" data-filter="${key}"${style}>${dotHtml}${d.label} <span id="pill-count-${key}"></span></button>`;
  }).join('\n');
}

/**
 * Client-side filter + pagination JS — paste into a <script> block.
 * pillKeys: array matching the pill data-filter values used on this page.
 * pageSize: cards per page (default 24).
 */
export function buildFilterScript({ pillKeys = ['all','active','pending','residential','land','sundgren','price-reduced'], pageSize = 24 } = {}) {
  return `
  var cards       = Array.from(document.querySelectorAll('.listing-card'));
  var grid        = document.getElementById('listing-grid');
  var countEl     = document.getElementById('listing-count');
  var noResults   = document.getElementById('no-results');
  var pills       = Array.from(document.querySelectorAll('.filter-pill'));
  var searchInput = document.getElementById('listing-search');
  var acList      = document.getElementById('search-autocomplete');
  var citySelect  = document.getElementById('city-filter');
  var sortSelect  = document.getElementById('sort-select');
  var clearLink   = document.getElementById('clear-filters-link');

  var activeFilter = 'all';
  var activeCity   = '';
  var activeSearch = '';
  var activeSort   = 'default';
  var acActiveIdx  = -1;
  var currentPage  = 1;
  var PAGE_SIZE    = ${pageSize};

  var originalOrder = Array.from(cards);

  function updatePillCounts() {
    ${JSON.stringify(pillKeys)}.forEach(function(f) {
      var el = document.getElementById('pill-count-' + f);
      if (!el) return;
      var n = cards.filter(function(c) {
        if (f === 'all')           return true;
        if (f === 'sundgren')      return c.classList.contains('listing-card--sundgren');
        if (f === 'price-reduced') return c.dataset.reduced === 'true';
        return c.dataset.status === f || c.dataset.type === f;
      }).length;
      el.textContent = '(' + n + ')';
    });
  }

  function getCardPrice(c) {
    var el = c.querySelector('.listing-card-price');
    if (!el) return 0;
    return parseInt(el.textContent.replace(/[^0-9]/g,'')) || 0;
  }

  function sortCards() {
    var sorted;
    if (activeSort === 'price-asc')  sorted = Array.from(cards).sort(function(a,b){ return getCardPrice(a)-getCardPrice(b); });
    else if (activeSort === 'price-desc') sorted = Array.from(cards).sort(function(a,b){ return getCardPrice(b)-getCardPrice(a); });
    else sorted = Array.from(originalOrder);
    sorted.forEach(function(c){ grid.appendChild(c); });
    cards = sorted;
  }

  function renderPagination(matched) {
    var totalPages = Math.ceil(matched.length / PAGE_SIZE);
    var pag = document.getElementById('listing-pagination');
    if (!pag) return;
    if (totalPages <= 1) { pag.innerHTML = ''; return; }
    var html = '';
    for (var i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === currentPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    pag.innerHTML = html;
    Array.from(pag.querySelectorAll('.page-btn')).forEach(function(b) {
      b.addEventListener('click', function() {
        currentPage = parseInt(b.dataset.page);
        applyFilters();
        window.scrollTo({top:0,behavior:'smooth'});
      });
    });
  }

  function applyFilters() {
    var q = activeSearch.trim().toLowerCase();
    var matched = [];
    cards.forEach(function(c) {
      var matchFilter = activeFilter === 'all'
        || c.dataset.status === activeFilter
        || c.dataset.type === activeFilter
        || (activeFilter === 'sundgren' && c.classList.contains('listing-card--sundgren'))
        || (activeFilter === 'price-reduced' && c.dataset.reduced === 'true');
      var matchCity   = !activeCity || c.dataset.city === activeCity;
      var matchSearch = !q || c.dataset.search.indexOf(q) !== -1;
      if (matchFilter && matchCity && matchSearch) matched.push(c);
      c.style.display = 'none';
    });
    var startIdx = (currentPage - 1) * PAGE_SIZE;
    matched.slice(startIdx, startIdx + PAGE_SIZE).forEach(function(c) { c.style.display = ''; });
    var visible = matched.length;
    if (countEl) countEl.innerHTML = '<strong>' + visible + '</strong> listing' + (visible !== 1 ? 's' : '') + ' shown';
    if (noResults) noResults.style.display = visible === 0 ? 'block' : 'none';
    if (grid) grid.style.display = visible === 0 ? 'none' : '';
    var dirty = activeFilter !== 'all' || activeCity || activeSearch || activeSort !== 'default';
    if (clearLink) clearLink.style.display = dirty ? 'inline' : 'none';
    renderPagination(matched);
  }

  pills.forEach(function(pill) {
    pill.addEventListener('click', function() {
      pills.forEach(function(p) { p.classList.remove('active'); });
      pill.classList.add('active');
      activeFilter = pill.dataset.filter;
      currentPage  = 1;
      applyFilters();
    });
  });

  if (sortSelect) {
    sortSelect.addEventListener('change', function() {
      activeSort  = sortSelect.value;
      currentPage = 1;
      sortCards();
      applyFilters();
    });
  }

  if (citySelect) {
    citySelect.addEventListener('change', function() {
      activeCity  = citySelect.value;
      currentPage = 1;
      applyFilters();
    });
  }

  // Autocomplete
  function hideAutocomplete() { if (acList) acList.innerHTML = ''; acActiveIdx = -1; }
  function showAutocomplete(terms, q) {
    if (!acList) return;
    var matches = terms.filter(function(t){ return t.toLowerCase().indexOf(q) === 0; }).slice(0,8);
    if (!matches.length) { hideAutocomplete(); return; }
    acList.innerHTML = matches.map(function(m,i){
      return '<li role="option" tabindex="-1" data-idx="' + i + '">' + m + '</li>';
    }).join('');
    Array.from(acList.querySelectorAll('li')).forEach(function(li) {
      li.addEventListener('mousedown', function(e) {
        e.preventDefault();
        searchInput.value = li.textContent;
        activeSearch = li.textContent;
        currentPage  = 1;
        hideAutocomplete();
        applyFilters();
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', function() {
      activeSearch = searchInput.value;
      currentPage  = 1;
      var q = activeSearch.trim().toLowerCase();
      if (q.length >= 2) showAutocomplete(window._listingSuggestions || [], q);
      else hideAutocomplete();
      applyFilters();
    });
    searchInput.addEventListener('keydown', function(e) {
      var items = acList ? Array.from(acList.querySelectorAll('li')) : [];
      if (e.key === 'ArrowDown') { acActiveIdx = Math.min(acActiveIdx+1, items.length-1); }
      else if (e.key === 'ArrowUp') { acActiveIdx = Math.max(acActiveIdx-1, -1); }
      else if (e.key === 'Enter' && acActiveIdx >= 0 && items[acActiveIdx]) {
        searchInput.value = items[acActiveIdx].textContent;
        activeSearch = searchInput.value;
        currentPage  = 1;
        hideAutocomplete();
        applyFilters();
        return;
      } else if (e.key === 'Escape') { hideAutocomplete(); return; }
      items.forEach(function(li,i){ li.classList.toggle('ac-active', i === acActiveIdx); });
    });
    document.addEventListener('click', function(e) {
      if (!searchInput.contains(e.target)) hideAutocomplete();
    });
  }

  if (clearLink) {
    clearLink.addEventListener('click', function(e) {
      e.preventDefault();
      searchInput.value = '';
      activeSearch = '';
      activeFilter = 'all';
      activeCity   = '';
      activeSort   = 'default';
      currentPage  = 1;
      pills.forEach(function(p) { p.classList.remove('active'); });
      var allPill = document.querySelector('[data-filter="all"]');
      if (allPill) allPill.classList.add('active');
      if (citySelect)  citySelect.value  = '';
      if (sortSelect)  sortSelect.value  = 'default';
      sortCards();
      applyFilters();
      hideAutocomplete();
    });
  }

  updatePillCounts();
  applyFilters();
`;
}
