import fs from 'fs';

let s = fs.readFileSync('generate-repliers-listings.mjs', 'utf8');

// ── 1. Strip infoCard from sidebar (replace with back link only) ──────────
s = s.replace(
  `<aside class="auction-sidebar">
        \${infoCard}
      </aside>`,
  `<aside class="auction-sidebar">
        <a href="\${esc(typeInfo.backLink)}" class="btn-all">&larr; \${esc(typeInfo.backLabel)}</a>
      </aside>`
);

// ── 2. Remove the Location h3 from inside renderMap (it's now in the row) ──
// Leaflet version
s = s.replace(
  `  <div class="desc-section" style="margin-top:24px;">
    <h3 class="desc-section-title"><i class="fas fa-map-marker-alt"></i> Location</h3>
    <div id="sg-map" style="height:300px;`,
  `  <div class="sg-map-inner">
    <div id="sg-map" style="height:300px;`
);
// OpenStreetMap iframe version (if present)
s = s.replace(
  `  <div class="desc-section" style="margin-top:24px;">
    <h3 class="desc-section-title"><i class="fas fa-map-marker-alt"></i> Location</h3>
    <iframe`,
  `  <div class="sg-map-inner">
    <iframe`
);
// Close the desc-section wrapper that we replaced
s = s.replace(
  /(<\/script>\s*\n\s*<\/div>`;\s*\n\s*\}[\s\S]{0,80}\/\/ \W+ Google Maps)/,
  (m) => m // leave as-is if present
);

// ── 3. Also strip Location h3 from the map-contact-row template in buildPage ──
s = s.replace(
  `          <div class="sg-map-col">
            <h3 class="desc-section-title" style="margin-bottom:14px;"><i class="fas fa-map-marker-alt"></i> Location</h3>
            \${mapHtml}
          </div>`,
  `          <div class="sg-map-col">
            \${mapHtml}
          </div>`
);

fs.writeFileSync('generate-repliers-listings.mjs', s, 'utf8');
console.log('patch2 done');
