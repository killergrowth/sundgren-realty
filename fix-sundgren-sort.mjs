/**
 * fix-sundgren-sort.mjs
 * 1. Re-sorts the existing repliers-listings.json — Sundgren first, rest by price desc
 * 2. Patches generate-repliers-listings.mjs to sort AFTER normalization (not before)
 */
import fs from 'fs';

// ── Step 1: Re-sort existing JSON immediately ─────────────────────────────
const jsonPath = 'data/repliers-listings.json';
const listings = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

listings.sort((a, b) => {
  if (a.isSundgren && !b.isSundgren) return -1;
  if (!a.isSundgren && b.isSundgren) return 1;
  return (b.price || 0) - (a.price || 0);
});

fs.writeFileSync(jsonPath, JSON.stringify(listings, null, 2), 'utf8');
console.log('✅ repliers-listings.json re-sorted');
console.log('   First 3:', listings.slice(0,3).map(l => l.agentName + ' / sundgren=' + l.isSundgren));
console.log('   Sundgren count:', listings.filter(l => l.isSundgren).length);
console.log('   Total:', listings.length);

// ── Step 2: Patch generator to sort after normalization ───────────────────
let s = fs.readFileSync('generate-repliers-listings.mjs', 'utf8');
s = s.replace(/\r\n/g, '\n');

// Find the end of the main loop that builds the index and add sort after
const oldFlat = `  // Flatten all listings into one array for similar listings widg`;
const newSort = `  // Sort: Sundgren listings first, then everyone else by price desc
  for (const type of Object.keys(index)) {
    index[type].sort((a, b) => {
      if (a.isSundgren && !b.isSundgren) return -1;
      if (!a.isSundgren && b.isSundgren) return 1;
      return (b.price || 0) - (a.price || 0);
    });
  }

  // Flatten all listings into one array for similar listings widg`;

if (s.includes(oldFlat)) {
  s = s.replace(oldFlat, newSort);
  fs.writeFileSync('generate-repliers-listings.mjs', s, 'utf8');
  console.log('✅ Generator patched — sort after normalization');
} else {
  console.warn('⚠️  Could not find flatten comment — sort already patched or location changed');
}
