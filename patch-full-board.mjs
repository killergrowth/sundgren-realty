/**
 * patch-full-board.mjs
 * Updates generate-repliers-listings.mjs to:
 * 1. Pull ALL boardId 254 listings (not just Sundgren's office)
 * 2. Tag Sundgren listings by agent name
 * 3. Sort Sundgren first, rest after
 * 4. Contact card on detail page: Sundgren branding for their listings,
 *    listing agent info for everyone else
 */
import fs from 'fs';

let s = fs.readFileSync('generate-repliers-listings.mjs', 'utf8');
s = s.replace(/\r\n/g, '\n');

// ── Fix 1: fetchListings — pull full board, not just Sundgren office ────────
const oldFetch = `async function fetchListings() {
  console.log('\\n  Fetching active listings (status=A)...');
  const active = await fetchAllPages({ officeId: '6701463544931', status: 'A' });
  console.log(\`  -> \${active.length} active\`);

  console.log('  Fetching unavailable listings (status=U)...');
  const unavail = await fetchAllPages({ officeId: '6701463544931', status: 'U' });
  console.log(\`  -> \${unavail.length} unavailable (pending/terminated)\`);

  return [...active, ...unavail];
}`;

const newFetch = `// Sundgren agent names — used to tag "our" listings across the full board
const SUNDGREN_AGENTS = new Set([
  'Ashley Chastain','Jeremy Sundgren','Kelsey Sundgren','Ashleigh Casper',
  'Audrey Reese','Deanne Woodard','Phillip Solorio','Steven Hall',
  'Tamara Cooley','Yousef Jesri','Barrett Simon','Erin Jones',
  'Rick Remsberg','Joe Sundgren','Susan Sundgren-Worrell',
]);

async function fetchListings() {
  console.log('\\n  Fetching ALL active SCK MLS listings (boardId=254, status=A)...');
  const active = await fetchAllPages({ boardId: 254, status: 'A' });
  console.log(\`  -> \${active.length} active\`);

  console.log('  Fetching unavailable/pending listings (boardId=254, status=U)...');
  const unavail = await fetchAllPages({ boardId: 254, status: 'U' });
  console.log(\`  -> \${unavail.length} unavailable (pending/terminated)\`);

  const all = [...active, ...unavail];

  // Tag Sundgren listings by agent name
  all.forEach(l => {
    const agentName = l.agents && l.agents[0] ? l.agents[0].name : '';
    l._isSundgren = SUNDGREN_AGENTS.has(agentName);
    l._agentName  = agentName;
    l._agentPhone = l.agents && l.agents[0] && l.agents[0].phones ? l.agents[0].phones[0] : '';
    l._agentEmail = l.agents && l.agents[0] && l.agents[0].emails ? l.agents[0].emails[0] : '';
  });

  // Sort: Sundgren first, then everyone else by price desc
  all.sort((a, b) => {
    if (a._isSundgren && !b._isSundgren) return -1;
    if (!a._isSundgren && b._isSundgren) return 1;
    return (b.listPrice || 0) - (a.listPrice || 0);
  });

  console.log(\`  -> \${all.filter(l => l._isSundgren).length} Sundgren listings pinned first\`);
  return all;
}`;

if (s.includes(oldFetch)) {
  s = s.replace(oldFetch, newFetch);
  console.log('✅ fetchListings updated — full board pull');
} else {
  console.error('❌ Could not find fetchListings block');
  process.exit(1);
}

// ── Fix 2: normalizeListings — preserve _isSundgren and agent fields ────────
// Find where normalized object is built and add isSundgren flag
const oldNormEnd = `    return {
      mlsId:      l.mlsNumber || '',
      type:       classify(l),
      status:     l.status || 'A',
      lastStatus: l.lastStatus || '',`;

const newNormEnd = `    return {
      mlsId:      l.mlsNumber || '',
      type:       classify(l),
      status:     l.status || 'A',
      lastStatus: l.lastStatus || '',
      isSundgren: l._isSundgren || false,
      agentName:  l._agentName || '',
      agentPhone: l._agentPhone || '',
      agentEmail: l._agentEmail || '',`;

if (s.includes(oldNormEnd)) {
  s = s.replace(oldNormEnd, newNormEnd);
  console.log('✅ normalizeListings — isSundgren + agent fields added');
} else {
  console.warn('⚠️  Could not find normalize return block — skipping (may already be patched)');
}

fs.writeFileSync('generate-repliers-listings.mjs', s, 'utf8');
console.log('Patch written.');
