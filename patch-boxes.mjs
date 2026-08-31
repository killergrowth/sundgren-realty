import fs from 'fs';

let s = fs.readFileSync('generate-repliers-listings.mjs', 'utf8');
s = s.replace(/\r\n/g, '\n');

// ── 1. Wrap renderFeatures output in the same info-card box ──
s = s.replace(
  `  return \`
  <div class="desc-section" style="margin-top:24px;">
    <h3 class="desc-section-title"><i class="fas fa-list-ul"></i> Property Features</h3>`,
  `  return \`
  <div class="info-card" style="margin-top:24px;">
    <h4 style="margin:0 0 16px;font-size:15px;display:flex;align-items:center;gap:8px;"><i class="fas fa-list-ul" style="color:var(--yellow-dark);"></i> Property Features</h4>`
);
// Close the section div
s = s.replace(
  `  </div>\`;\n}\n\n// ── Render Map`,
  `  </div>\`;\n}\n\n// ── Render Map`
);
// Also close the feat-grid div properly — find the closing tag after feat-grid
s = s.replace(
  `</div>\n  </div>\`;\n}\n\n// `,
  `</div>\n  </div>\`;\n}\n\n// `
);

// ── 2. Wrap renderMap output in the same info-card box with single heading ──
s = s.replace(
  `  <div class="sg-map-inner">\n    <div id="sg-map"`,
  `  <div class="info-card" style="height:100%;box-sizing:border-box;">\n    <h4 style="margin:0 0 14px;font-size:15px;display:flex;align-items:center;gap:8px;"><i class="fas fa-map-marker-alt" style="color:var(--yellow-dark);"></i> Location</h4>\n    <div id="sg-map"`
);

// Handle iframe variant too
s = s.replace(
  `  <div class="sg-map-inner">\n    <iframe`,
  `  <div class="info-card" style="height:100%;box-sizing:border-box;">\n    <h4 style="margin:0 0 14px;font-size:15px;display:flex;align-items:center;gap:8px;"><i class="fas fa-map-marker-alt" style="color:var(--yellow-dark);"></i> Location</h4>\n    <iframe`
);

// Fix the closing — the old desc-section closing divs need to become info-card
// Find the renderMap closing pattern  
s = s.replace(
  `    <\/script>\n  </div>\`;\n  }\n  // fallback`,
  `    <\/script>\n  </div>\`;\n  }\n  // fallback`
);

// Verify
const infoCards = (s.match(/class="info-card"/g) || []).length;
const descSections = (s.match(/class="desc-section"/g) || []).length;
console.log(`info-card occurrences: ${infoCards}`);
console.log(`desc-section remaining: ${descSections}`);

fs.writeFileSync('generate-repliers-listings.mjs', s, 'utf8');
console.log('patch-boxes done');
