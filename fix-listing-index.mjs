/**
 * fix-listing-index.mjs
 * Patches build-type-index-pages.mjs to fix:
 * 1. Script executes before DOM cards exist (script was between FOOTER comment and actual card HTML)
 * 2. Autocomplete suggestions include slug strings (contain hyphens+numbers)
 * 3. esc() used in browser JS but only defined at build time
 */
import fs from 'fs';

let s = fs.readFileSync('build-type-index-pages.mjs', 'utf8');
s = s.replace(/\r\n/g, '\n');

// ── Fix 1: Move <script> block to just before </body> ─────────────────────
// The template has: <!-- FOOTER --> \n\n <script>...\n</body>
// We need: <!-- FOOTER --> </body> and move the script block before </body>
// Strategy: strip the script from where it currently sits, put it right before </body>

const scriptStart = s.indexOf('\n<script>\n(function(){');
const scriptEnd   = s.indexOf('\n})();\n</script>\n</body>');

if (scriptStart < 0 || scriptEnd < 0) {
  console.error('Could not find script block boundaries');
  console.log('scriptStart:', scriptStart, 'scriptEnd:', scriptEnd);
  process.exit(1);
}

const scriptBlock = s.substring(scriptStart, scriptEnd + '\n})();\n</script>\n'.length);
const beforeScript = s.substring(0, scriptStart);
const afterScript  = s.substring(scriptEnd + '\n})();\n</script>\n'.length); // this starts with </body>

// Reassemble: everything up to script | footer + cards (afterScript) | script | </body>
// afterScript should now be just "</body>\n</html>"
console.log('afterScript starts with:', JSON.stringify(afterScript.substring(0, 30)));

// The cards are in afterScript because the FOOTER comment gets filled AFTER the template
// So: beforeScript ends right before the script block (which is after <!-- FOOTER --> comment)
// We move script to just before </body> in afterScript

const newS = beforeScript +
  '\n' +
  afterScript.replace('</body>', scriptBlock + '\n</body>');

fs.writeFileSync('build-type-index-pages.mjs', newS, 'utf8');
console.log('Fix 1 done: script moved to before </body>');

// ── Fix 2: Filter slug-style strings from suggestions ─────────────────────
// Slugs look like: "000-143rd-st-e-valley-center-ks-678080" — contain hyphens between words+numbers
// Real addresses: "000 143rd St" — spaces, not hyphens
// Filter: skip items that match /^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+/
let s2 = fs.readFileSync('build-type-index-pages.mjs', 'utf8');
s2 = s2.replace(/\r\n/g, '\n');

const oldSugFilter = `  const suggestions = [...new Set(
    listings.flatMap(l => [
      streetOnly(l.address),
      cityOf(l).trim(),
      statusLabel(l),
      l.type.charAt(0).toUpperCase() + l.type.slice(1),
    ]).filter(Boolean)
  )].sort();`;

const newSugFilter = `  const suggestions = [...new Set(
    listings.flatMap(l => [
      streetOnly(l.address),
      cityOf(l).trim(),
      statusLabel(l),
      l.type.charAt(0).toUpperCase() + l.type.slice(1),
    ]).filter(v => {
      if (!v) return false;
      // Skip slug-style strings (hyphens between alphanumeric segments)
      if (/^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+/i.test(v)) return false;
      // Skip HTML entities left from escaping
      if (v.includes('&amp;') || v.includes('&lt;')) return false;
      return true;
    })
  )].sort();`;

if (s2.includes(oldSugFilter)) {
  s2 = s2.replace(oldSugFilter, newSugFilter);
  console.log('Fix 2 done: suggestion filter updated');
} else {
  console.warn('Fix 2: could not find suggestion filter block — check manually');
}

// ── Fix 3: Add browser-side esc() to the inline script ───────────────────
// The script currently uses esc() inside the autocomplete li builder,
// but esc() is only defined at Node build time. Add it to the IIFE.
const oldIIFE = `(function(){\n  // ── Autocomplete data`;
const newIIFE = `(function(){\n  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}\n  // ── Autocomplete data`;

if (s2.includes(oldIIFE)) {
  s2 = s2.replace(oldIIFE, newIIFE);
  console.log('Fix 3 done: esc() added to browser IIFE');
} else {
  console.warn('Fix 3: could not find IIFE marker — check manually');
}

fs.writeFileSync('build-type-index-pages.mjs', s2, 'utf8');
console.log('All fixes applied. Running build-type-index-pages.mjs to verify...');
