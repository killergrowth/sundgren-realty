import fs from 'fs';
let s = fs.readFileSync('build-type-index-pages.mjs', 'utf8');
s = s.replace(/\r\n/g, '\n');

// Replace the broken regex line with a safe version that doesn't use backslashes inside template literal
const bad = s.match(/var re = new RegExp\(.+\n?.+\), 'gi'\);/)?.[0]
  || s.match(/var re = new RegExp\(.+\), 'gi'\);/)?.[0];

console.log('Found:', bad);

// Replace with a simpler approach using indexOf for highlighting instead of regex
s = s.replace(
  /var re = new RegExp\(.*?\), 'gi'\);.*?\n.*?var highlighted = m\.replace\(re, '<mark>\$1<\/mark>'\);/s,
  `// highlight matching chars
      var lower = m.toLowerCase();
      var idx2 = lower.indexOf(ql);
      var highlighted = idx2 >= 0
        ? esc(m.slice(0, idx2)) + '<mark>' + esc(m.slice(idx2, idx2 + ql.length)) + '</mark>' + esc(m.slice(idx2 + ql.length))
        : esc(m);`
);

fs.writeFileSync('build-type-index-pages.mjs', s, 'utf8');
console.log('patch-regex done');
