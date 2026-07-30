/**
 * fetch-idx-listings.mjs — Sundgren Realty IDX Broker API data pull
 *
 * SAFE BY DESIGN:
 *   - Only calls GET endpoints
 *   - Whitelisted endpoints only (listings, featured, soldpending, mls metadata)
 *   - Key is loaded from environment variable only — never committed to source
 *   - No PUT, POST, or DELETE — never touches leads, account, or settings
 *
 * Usage:
 *   IDX_API_KEY=<key> node fetch-idx-listings.mjs
 *
 * Output:
 *   data/idx-listings.json
 *
 * Run this before node build.js to refresh listing data.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CONFIGURATION ────────────────────────────────────────────────────────────

const API_KEY = process.env.IDX_API_KEY;
if (!API_KEY) {
  console.error('ERROR: IDX_API_KEY environment variable is not set.');
  console.error('Usage: IDX_API_KEY=<your-key> node fetch-idx-listings.mjs');
  process.exit(1);
}

const BASE_URL = 'https://api.idxbroker.com';

// Whitelisted read-only endpoints ONLY
// Never call /leads, /partners, or any write method
const ALLOWED_ENDPOINTS = [
  '/clients/listings',
  '/clients/featured',
  '/clients/soldpending',
  '/mls/cities',
];

const HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'accesskey': API_KEY,
  'outputtype': 'json',
};

const OUT_DIR  = path.join(__dirname, 'data');
const OUT_FILE = path.join(OUT_DIR, 'idx-listings.json');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function idxGet(endpoint, params = {}) {
  // Safety check — only whitelisted endpoints
  if (!ALLOWED_ENDPOINTS.some(e => endpoint.startsWith(e))) {
    throw new Error(`BLOCKED: endpoint "${endpoint}" is not on the allowlist.`);
  }

  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${endpoint}${qs ? '?' + qs : ''}`;

  console.log(`  GET ${endpoint}${qs ? '?' + qs : ''}`);

  const res = await fetch(url, { method: 'GET', headers: HEADERS });

  if (res.status === 204) return null; // empty result
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`IDX API error ${res.status} on ${endpoint}: ${body}`);
  }

  return res.json();
}

function normalizeListing(raw) {
  // Map IDX Broker listing fields to a clean flat object
  // Only extract what we need for display — nothing sensitive
  return {
    idxId:       raw.idxID       || raw.listingID || null,
    listingId:   raw.listingID   || null,
    mlsNum:      raw.listingID   || null,
    status:      (raw.propStatus || raw.status || 'active').toLowerCase(),
    address:     raw.address     || '',
    city:        raw.cityName    || raw.city || '',
    state:       raw.state       || 'KS',
    zip:         raw.zipcode     || raw.zip || '',
    price:       raw.listPrice   || raw.price || null,
    beds:        raw.bedrooms    || null,
    baths:       raw.totalBaths  || raw.bathrooms || null,
    sqft:        raw.sqFt        || raw.squareFeet || null,
    acres:       raw.acreage     || null,
    description: raw.remarksConcat || raw.remarks || '',
    photo:       raw.image?.fullAddress || raw.mainPhoto || raw.mainPhotoUrl || null,
    detailUrl:   raw.detailsURL  || raw.idxPropUrl || null,
    propType:    raw.propType    || raw.propertyType || '',
    listDate:    raw.listDate    || null,
    // Flag for featured
    featured:    raw.featured === '1' || raw.featured === true || false,
  };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching IDX Broker listings for Sundgren Realty...');
  console.log('(Read-only. No account/lead endpoints will be called.)\n');

  const result = {
    fetchedAt: new Date().toISOString(),
    active:    [],
    featured:  [],
    sold:      [],
    residential: [],
    land:        [],
    commercial:  [],
  };

  // 1. All active listings
  try {
    const raw = await idxGet('/clients/listings');
    if (raw && typeof raw === 'object') {
      const listings = Object.values(raw).flatMap(v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []));
      result.active = listings.map(normalizeListing);
      console.log(`  -> ${result.active.length} active listings`);
    }
  } catch (e) {
    console.warn(`  WARN: /clients/listings failed: ${e.message}`);
  }

  // 2. Featured listings
  try {
    const raw = await idxGet('/clients/featured');
    if (raw && typeof raw === 'object') {
      const listings = Object.values(raw).flatMap(v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []));
      result.featured = listings.map(normalizeListing);
      console.log(`  -> ${result.featured.length} featured listings`);
    }
  } catch (e) {
    console.warn(`  WARN: /clients/featured failed: ${e.message}`);
  }

  // 3. Sold/Pending
  try {
    const raw = await idxGet('/clients/soldpending');
    if (raw && typeof raw === 'object') {
      const listings = Object.values(raw).flatMap(v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []));
      result.sold = listings.map(normalizeListing);
      console.log(`  -> ${result.sold.length} sold/pending listings`);
    }
  } catch (e) {
    console.warn(`  WARN: /clients/soldpending failed: ${e.message}`);
  }

  // 4. Categorize active listings by type
  for (const listing of result.active) {
    const type = (listing.propType || '').toLowerCase();
    // Land/acreage keywords
    if (type.includes('land') || type.includes('farm') || type.includes('acreage') || type.includes('lot')) {
      result.land.push(listing);
    // Commercial
    } else if (type.includes('commercial') || type.includes('business')) {
      result.commercial.push(listing);
    // Default residential
    } else {
      result.residential.push(listing);
    }
  }

  console.log(`\n  Categorized: ${result.residential.length} residential | ${result.land.length} land | ${result.commercial.length} commercial`);

  // Write output
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\nWritten: ${OUT_FILE}`);
  console.log(`Total active: ${result.active.length} | Featured: ${result.featured.length} | Sold/Pending: ${result.sold.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
