import fs from 'fs';
let s = fs.readFileSync('_partials/header.html', 'utf8');
s = s.replace(/\r\n/g, '\n');
s = s.replace('href="/residential/"', 'href="/listings/residential/"');
s = s.replace('href="/land-listings/"', 'href="/listings/land/"');
fs.writeFileSync('_partials/header.html', s, 'utf8');
console.log('nav fixed');
