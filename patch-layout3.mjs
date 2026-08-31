import fs from 'fs';

let s = fs.readFileSync('generate-repliers-listings.mjs', 'utf8');

// Normalize all CRLF to LF for clean matching
s = s.replace(/\r\n/g, '\n');

// ── 1. Remove infoCard from sidebar, replace with back link ──
s = s.replace(
  `<aside class="auction-sidebar">\n        \${infoCard}\n      </aside>`,
  `<aside class="auction-sidebar">\n        <a href="\${esc(typeInfo.backLink)}" class="btn-all">&larr; \${esc(typeInfo.backLabel)}</a>\n      </aside>`
);

// ── 2. Remove duplicate Location h3 from the map-contact-row template ──
s = s.replace(
  `          <div class="sg-map-col">\n            <h3 class="desc-section-title" style="margin-bottom:14px;"><i class="fas fa-map-marker-alt"></i> Location</h3>\n            \${mapHtml}\n          </div>`,
  `          <div class="sg-map-col">\n            \${mapHtml}\n          </div>`
);

// ── 3. Remove Location h3 from inside renderMap (Leaflet version) ──
s = s.replace(
  `  <div class="desc-section" style="margin-top:24px;">\n    <h3 class="desc-section-title"><i class="fas fa-map-marker-alt"></i> Location</h3>\n    <div id="sg-map"`,
  `  <div class="sg-map-inner">\n    <div id="sg-map"`
);

// Also handle iframe map variant
s = s.replace(
  `  <div class="desc-section" style="margin-top:24px;">\n    <h3 class="desc-section-title"><i class="fas fa-map-marker-alt"></i> Location</h3>\n    <iframe`,
  `  <div class="sg-map-inner">\n    <iframe`
);

// Verify
const infoCardCount = (s.match(/\$\{infoCard\}/g) || []).length;
const locationH3Count = (s.match(/fa-map-marker-alt"><\/i> Location<\/h3>/g) || []).length;
const sidebarOk = s.includes(`class="auction-sidebar">\n        <a href=`);
console.log(`infoCard occurrences: ${infoCardCount} (want 1)`);
console.log(`Location h3 in output: ${locationH3Count} (want 0)`);
console.log(`sidebar back-link only: ${sidebarOk}`);

fs.writeFileSync('generate-repliers-listings.mjs', s, 'utf8');
console.log('patch3 done');
