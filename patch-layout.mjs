import fs from 'fs';

let s = fs.readFileSync('generate-repliers-listings.mjs', 'utf8');

// 1. Remove mapHtml from the desc block
s = s.replace(
  '${descHtml}\n          ${featuresHtml}\n          ${mapHtml}',
  '${descHtml}\n          ${featuresHtml}'
);

// also handle CRLF variant
s = s.replace(
  '${descHtml}\r\n          ${featuresHtml}\r\n          ${mapHtml}',
  '${descHtml}\r\n          ${featuresHtml}'
);

// 2. Remove the Location h3 from renderMap — it'll now be in the row heading
s = s.replace(
  `  <div class="desc-section" style="margin-top:24px;">
    <h3 class="desc-section-title"><i class="fas fa-map-marker-alt"></i> Location</h3>
    <div id="sg-map"`,
  `  <div class="sg-map-inner">
    <div id="sg-map"`
);
s = s.replace(
  '  </div>`;\n  }',
  '  </div>\n  </div>`;\n  }'
);

// 3. Swap old sidebar+disclaimer block for new map+contact row layout
const OLD = `      <!-- Right Column (Sidebar) -->
      <aside class="auction-sidebar">
        \${infoCard}
      </aside>`;

const NEW = `      <!-- Right Column (Sidebar) -->
      <aside class="auction-sidebar">
        <a href="\${esc(typeInfo.backLink)}" class="btn-all">&larr; \${esc(typeInfo.backLabel)}</a>
      </aside>`;

// Insert the map+contact row before the disclaimer, after featuresHtml block
const DISCLAIMER = `        <!-- Disclaimer -->`;
const MAP_ROW = `        <!-- Map + Contact row -->
        <div class="sg-map-contact-row">
          <div class="sg-map-col">
            <h3 class="desc-section-title" style="margin-bottom:14px;"><i class="fas fa-map-marker-alt"></i> Location</h3>
            \${mapHtml}
          </div>
          <div class="sg-contact-col">
            \${infoCard}
          </div>
        </div>

        <!-- Disclaimer -->`;

s = s.replace(DISCLAIMER, MAP_ROW);
s = s.replace(OLD, NEW);

fs.writeFileSync('generate-repliers-listings.mjs', s, 'utf8');
console.log('patch applied');
