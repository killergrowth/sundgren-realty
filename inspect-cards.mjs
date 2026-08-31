import fs from 'fs';

const s = fs.readFileSync('residential.html', 'utf8');

// Find the listing grid and show first 2 full cards
const gridIdx = s.indexOf('<div class="listing-grid">');
const chunk = s.substring(gridIdx, gridIdx + 2000);
console.log(chunk);
