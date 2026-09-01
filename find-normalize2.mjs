import fs from 'fs';
const s = fs.readFileSync('generate-repliers-listings.mjs', 'utf8');

// Show the full index builder object
const idx = s.indexOf("index[typeInfo.type].push({");
console.log(s.substring(idx, idx + 800));
