
document.addEventListener('DOMContentLoaded', function(){
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  // ── Autocomplete data ──────────────────────────────────────────────────────
  var SUGGESTIONS = ["0 161st St","0 Butler Rd","0 Creekside Cr","0 Mulberry Road","0 Parallel St","0 Purity Springs Rd","0 Timber Circle","00 Creekside Cr","00 Hwy 54","00 Satchell Creek Rd","000 140th St","000 51st Road","000 Hwy 54","000 MacArthur RD","000 Parallel","0000 119th St W ST","0000 119th St. S","0000 183rd St W ST","0000 199th St W","0000 37th St N","0000 Cr","0000 Meridian","00000 222nd Rd","00000 36th","00000 383rd","00000 7th ST","00000 Barker","00000 County Line Rd","00000 Cr","00000 Payne Ct Lot 2 AVE","10035 Diamond Rd","10100 Rock Rd","1133 Flint Hills National Pkwy","11467 Shore Dr","1209 Bluestem Ct","12155 Hwy 54","1219 Flint Hills National Pkwy","1406 Flint Hills National Pkwy","1501 101st St N St","1518 1st Street N ST","1524 Flint Hills National Pkwy","1782 Indianola Rd","182nd","20611 Kellogg St","222 Millheisler Rd","2412 Doris Cir","28719 Harry St","413 Hwy 54","4583 Portwest St","4608 Butler Rd","5500 MacArthur","5900 Meridian","635 Central Ave","7501 53rd St N St","809 Hwy 54","9815 Rock Rd","9950 Rock Rd","9975 Rock Rd","Active","Andover","Augusta","Benton","Cheney","Douglass","El Dorado","Florence","Garden Plain","Goddard","Haysville","Hillsboro","LOT 7 Village Circle","Land","Lehigh","Maize","Mulvane","Newton","Rosalia","Rose Hill","TBD Meridian","Valley Center","Wichita","Winfield"];

  var searchInput  = document.getElementById('listing-search');
  var acList       = document.getElementById('search-autocomplete');
  var cards        = Array.from(document.querySelectorAll('.listing-card'));
  var countEl      = document.getElementById('results-count');
  var noResults    = document.getElementById('no-results');
  var grid         = document.getElementById('listing-grid');
  var pills        = Array.from(document.querySelectorAll('.filter-pill'));

  var activeFilter = 'all';
  var activeSearch = '';
  var acActiveIdx  = -1;

  // ── Pill counts ────────────────────────────────────────────────────────────
  function updatePillCounts() {
    var filters = ['all','active','pending','residential','land'];
    filters.forEach(function(f) {
      var el = document.getElementById('pill-count-' + f);
      if (!el) return;
      var n = cards.filter(function(c) {
        if (f === 'all') return true;
        return c.dataset.status === f || c.dataset.type === f;
      }).length;
      el.textContent = '(' + n + ')';
    });
  }

  // ── Filter + search ────────────────────────────────────────────────────────
  function applyFilters() {
    var q = activeSearch.trim().toLowerCase();
    var visible = 0;
    cards.forEach(function(c) {
      var matchFilter = true;
      if (activeFilter !== 'all') {
        matchFilter = c.dataset.status === activeFilter || c.dataset.type === activeFilter;
      }
      var matchSearch = !q || c.dataset.search.indexOf(q) !== -1;
      var show = matchFilter && matchSearch;
      c.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    countEl.innerHTML = '<strong>' + visible + '</strong> listing' + (visible !== 1 ? 's' : '') + ' shown';
    noResults.style.display = visible === 0 ? 'block' : 'none';
    grid.style.display = visible === 0 ? 'none' : '';
  }

  // ── Pills ──────────────────────────────────────────────────────────────────
  pills.forEach(function(pill) {
    pill.addEventListener('click', function() {
      pills.forEach(function(p) { p.classList.remove('active'); });
      pill.classList.add('active');
      activeFilter = pill.dataset.filter;
      applyFilters();
    });
  });

  // ── Search input ───────────────────────────────────────────────────────────
  searchInput.addEventListener('input', function() {
    activeSearch = searchInput.value;
    applyFilters();
    showAutocomplete(searchInput.value);
  });

  searchInput.addEventListener('keydown', function(e) {
    var items = acList.querySelectorAll('li');
    if (e.key === 'ArrowDown') {
      acActiveIdx = Math.min(acActiveIdx + 1, items.length - 1);
      updateAcActive(items);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      acActiveIdx = Math.max(acActiveIdx - 1, -1);
      updateAcActive(items);
      e.preventDefault();
    } else if (e.key === 'Enter' && acActiveIdx >= 0 && items[acActiveIdx]) {
      selectSuggestion(items[acActiveIdx].dataset.value);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      hideAutocomplete();
    }
  });

  function updateAcActive(items) {
    items.forEach(function(li, i) {
      li.classList.toggle('active', i === acActiveIdx);
    });
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

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  document.addEventListener('click', function(e) {
    if (!searchInput.contains(e.target) && !acList.contains(e.target)) hideAutocomplete();
  });

  // ── Clear all filters ──────────────────────────────────────────────────────
  window.clearFilters = function() {
    searchInput.value = '';
    activeSearch = '';
    activeFilter = 'all';
    pills.forEach(function(p) { p.classList.remove('active'); });
    document.querySelector('[data-filter="all"]').classList.add('active');
    applyFilters();
    hideAutocomplete();
  };

  // ── Init ───────────────────────────────────────────────────────────────────
  updatePillCounts();
  applyFilters();
}); // end DOMContentLoaded
