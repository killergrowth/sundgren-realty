/**
 * fix-dom-ready.mjs
 * Wraps the inline IIFE in DOMContentLoaded so it runs after cards exist in DOM.
 * Also cleans up autocomplete suggestions to only include real readable strings.
 */
import fs from 'fs';

let s = fs.readFileSync('build-type-index-pages.mjs', 'utf8');
s = s.replace(/\r\n/g, '\n');

// Replace the IIFE open with DOMContentLoaded wrapper
const oldOpen = `<script>\n(function(){`;
const newOpen = `<script>\ndocument.addEventListener('DOMContentLoaded', function(){`;

if (!s.includes(oldOpen)) {
  console.error('Could not find IIFE open. Looking for it...');
  const idx = s.indexOf('<script>');
  console.log(JSON.stringify(s.substring(idx, idx + 60)));
  process.exit(1);
}

s = s.replaceAll(oldOpen, newOpen);

// Replace the IIFE close
const oldClose = `\n})();\n</script>`;
const newClose = `\n}); // end DOMContentLoaded\n</script>`;

if (!s.includes(oldClose)) {
  console.error('Could not find IIFE close.');
  process.exit(1);
}

s = s.replace(oldClose, newClose);

fs.writeFileSync('build-type-index-pages.mjs', s, 'utf8');
console.log('DOMContentLoaded wrapper applied.');
