import fs from 'fs';
const s = fs.readFileSync('generate-repliers-listings.mjs', 'utf8');

// Find where the normalized listing object is built (has slug, address, price, image, etc.)
const markers = ['slug:', 'address:', 'price:', 'image:', 'beds:', 'acres:'];
for (const m of markers) {
  const idx = s.indexOf(m);
  if (idx >= 0) {
    console.log(`\n=== "${m}" at ${idx} ===`);
    console.log(s.substring(idx - 300, idx + 200));
    break;
  }
}
