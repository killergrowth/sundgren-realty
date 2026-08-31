import fs from 'fs';

const file = new URL('./generate-repliers-listings.mjs', import.meta.url).pathname.slice(1);
let c = fs.readFileSync(file, 'utf8');

// ── Fix 1: Replace old single-fetch fetchListings with paginated officeId version ──
const oldStart = c.indexOf('async function fetchListings()');
const oldEnd   = c.indexOf('\n}', oldStart) + 2;
const oldFetch = c.substring(oldStart, oldEnd);

const newFetch = `async function fetchAllPages(params) {
  const allListings = [];
  let page = 1;
  while (true) {
    const qs = Object.entries({ ...params, pageNum: page, resultsPerPage: 100 })
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
    const url = \`\${REPLIERS_API_URL}?\${qs}\`;
    console.log(\`  Fetching page \${page}: \${url}\`);
    const res = await fetch(url, { headers: { 'REPLIERS-API-KEY': REPLIERS_API_KEY } });
    if (!res.ok) throw new Error(\`Repliers API error: \${res.status} \${res.statusText}\`);
    const data = await res.json();
    allListings.push(...(data.listings || []));
    if (page >= (data.numPages || 1)) break;
    page++;
  }
  return allListings;
}

async function fetchListings() {
  console.log('\\n  Fetching active listings (status=A)...');
  const active = await fetchAllPages({ officeId: '6701463544931', status: 'A' });
  console.log(\`  -> \${active.length} active\`);

  console.log('  Fetching unavailable listings (status=U)...');
  const unavail = await fetchAllPages({ officeId: '6701463544931', status: 'U' });
  console.log(\`  -> \${unavail.length} unavailable (pending/terminated)\`);

  return [...active, ...unavail];
}`;

if (!c.includes('fetchAllPages')) {
  c = c.substring(0, oldStart) + newFetch + c.substring(oldEnd);
  console.log('✓ Fix 1: fetchListings replaced with paginated officeId version');
} else {
  console.log('  Fix 1: fetchAllPages already present, skipping');
}

// ── Fix 2: Add resolved as first line of buildPage ──
const bpOld = 'function buildPage(listing, typeInfo, slug, allListings) {\n  const addr';
const bpNew = 'function buildPage(listing, typeInfo, slug, allListings) {\n  const resolved = listing._resolved || resolveStatus(listing);\n  const addr';

if (!c.includes('const resolved = listing._resolved')) {
  if (c.includes(bpOld)) {
    c = c.replace(bpOld, bpNew);
    console.log('✓ Fix 2: resolved added to top of buildPage');
  } else {
    console.log('  Fix 2: buildPage signature not found as expected — check manually');
  }
} else {
  console.log('  Fix 2: resolved already in buildPage, skipping');
}

// ── Verify ──
console.log('\nVerification:');
console.log('  fetchAllPages present:', c.includes('fetchAllPages'));
console.log('  officeId 6701463544931:', c.includes('6701463544931'));
console.log('  agent=Jeremy gone:', !c.includes('agent=Jeremy+Sundgren'));
console.log('  resolved in buildPage:', c.includes('function buildPage(listing, typeInfo, slug, allListings) {\n  const resolved'));

fs.writeFileSync(file, c, 'utf8');
console.log('\nFile patched and saved.');
