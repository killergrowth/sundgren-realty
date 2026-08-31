import fs from 'fs';
let s = fs.readFileSync('build-type-index-pages.mjs', 'utf8');
s = s.replace(/\r\n/g, '\n');

// Find and replace the broken regex highlight block
const broken = `var re = new RegExp('(' + ql.replace(/[.*+?^${}()|[\\\\]\\\\\\\\]/g,'\\\\\\\\$&') + ')', 'gi');\n      var highlighted = m.replace(re, '<mark>$1</mark>');`;
const fixed  = `var li2 = m.toLowerCase().indexOf(ql);\n      var highlighted = li2 >= 0 ? m.slice(0,li2) + '<mark>' + m.slice(li2, li2+ql.length) + '</mark>' + m.slice(li2+ql.length) : m;`;

if (s.includes(broken)) {
  s = s.replace(broken, fixed);
  console.log('Fixed highlight block OK');
} else {
  // Try without the trailing semicolon variation
  const idx = s.indexOf("var re = new RegExp('(");
  console.log('Not found exactly. idx=', idx);
  if (idx >= 0) console.log('FOUND AT', idx, JSON.stringify(s.substring(idx, idx + 200)));
}

fs.writeFileSync('build-type-index-pages.mjs', s, 'utf8');
