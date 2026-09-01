/**
 * Rewrites the showAutocomplete function in build-type-index-pages.mjs cleanly.
 * Replaces the broken highlight+li-builder line with correct separated code.
 */
import fs from 'fs';

let s = fs.readFileSync('build-type-index-pages.mjs', 'utf8');
s = s.replace(/\r\n/g, '\n');

// Find the showAutocomplete function and replace the entire li-building block
// with a clean version that keeps highlight and li-build on separate lines.
const oldBlock = s.match(/acList\.innerHTML = matches\.map\(function\(m\) \{[\s\S]+?\}\)\.join\(''\);/)?.[0];
if (!oldBlock) {
  console.error('Could not find acList.innerHTML block');
  process.exit(1);
}
console.log('Found block:\n', oldBlock.substring(0, 200));

const newBlock = `acList.innerHTML = matches.map(function(m) {
      var li2 = m.toLowerCase().indexOf(ql);
      var highlighted = li2 >= 0
        ? m.slice(0, li2) + '<mark>' + m.slice(li2, li2 + ql.length) + '</mark>' + m.slice(li2 + ql.length)
        : m;
      return '<li data-value="' + esc(m) + '">' + highlighted + '</li>';
    }).join('');`;

s = s.replace(oldBlock, newBlock);
fs.writeFileSync('build-type-index-pages.mjs', s, 'utf8');
console.log('Fixed. Verifying with node --check...');
