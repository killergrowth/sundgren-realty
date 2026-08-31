import fs from 'fs';

let s = fs.readFileSync('generate-repliers-listings.mjs', 'utf8');
s = s.replace(/\r\n/g, '\n');

// ── 1. Remove pills from auction-hero-meta block ──────────────────────────
s = s.replace(
  `    <div class="auction-hero-meta">\n      <span class="\${statusPillClass(resolved)} pill">\${statusLabel(resolved)}</span>\n      <span class="pill" style="background:rgba(0,0,0,.45);color:#fff;border:1px solid rgba(255,255,255,.25);">\${esc(typeInfo.label)}</span>\n    </div>\n    <h1 class="auction-hero-title">`,
  `    <h1 class="auction-hero-title">`
);

// ── 2. Overlay pills on the mosaic hero photo ─────────────────────────────
// renderPhotoGrid accepts images only — we need to pass pills in.
// Easiest: build the pills HTML in buildPage and inject after photoGrid render
// by wrapping the mosaic hero in a relative div with absolute pill overlay.
// We do this by replacing the renderPhotoGrid call site in the template.

// Current: ${photoGrid}
// New: wrap photoGrid output with a position:relative div that adds the pills

s = s.replace(
  `        \${photoGrid}

        \${statsRow}`,
  `        \${photoGrid ? \`<div class="sg-photo-pill-wrap">\${photoGrid}<div class="sg-photo-pills"><span class="\${statusPillClass(resolved)} pill">\${statusLabel(resolved)}</span><span class="pill sg-type-pill">\${esc(typeInfo.label)}</span></div></div>\` : ''}

        \${statsRow}`
);

// ── 3. Add CSS for the pill overlay ──────────────────────────────────────
// Inject into the <style> block in buildPage
s = s.replace(
  `.sg-mosaic-hero img { width:100%; height:100%; object-fit:cover; display:block; }`,
  `.sg-mosaic-hero img { width:100%; height:100%; object-fit:cover; display:block; }
    .sg-photo-pill-wrap { position:relative; }
    .sg-photo-pills { position:absolute; top:14px; left:14px; z-index:10; display:flex; gap:8px; flex-wrap:wrap; }
    .sg-type-pill { background:rgba(0,0,0,.52)!important; color:#fff!important; border:1px solid rgba(255,255,255,.28)!important; }`
);

// Verify
const pillsInHero = (s.match(/auction-hero-meta/g) || []).length;
const pillsOnPhoto = (s.match(/sg-photo-pills/g) || []).length;
console.log(`auction-hero-meta remaining: ${pillsInHero} (want 0)`);
console.log(`sg-photo-pills injected: ${pillsOnPhoto} (want 2 — template + css)`);

fs.writeFileSync('generate-repliers-listings.mjs', s, 'utf8');
console.log('patch-pills done');
