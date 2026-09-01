import fs from 'fs';
const s = fs.readFileSync('dist/listings/land/index.html', 'utf8');

// Check data attributes on first card
const idx = s.indexOf('listing-card');
const cardChunk = s.substring(idx - 5, idx + 400);
console.log('FIRST CARD HTML:\n', cardChunk);
console.log('\n---');

// Count cards with data-filter attributes
const dataStatus = (s.match(/data-status=/g) || []).length;
const dataType   = (s.match(/data-type=/g) || []).length;
const dataSearch = (s.match(/data-search=/g) || []).length;
console.log('Cards with data-status:', dataStatus);
console.log('Cards with data-type:', dataType);
console.log('Cards with data-search:', dataSearch);

// Check pill HTML
const pillIdx = s.indexOf('data-filter=');
console.log('\nFIRST PILL:', s.substring(pillIdx - 30, pillIdx + 80));

// Check if filter-pill class matches what querySelector finds
const pillCount = (s.match(/class="filter-pill/g) || []).length;
console.log('filter-pill elements:', pillCount);
