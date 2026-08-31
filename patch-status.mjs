import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, 'generate-repliers-listings.mjs');
let c = fs.readFileSync(file, 'utf8');

// Find old statusPillClass + statusLabel block and replace with full status system
const oldStart = c.indexOf('function statusPillClass');
const oldEnd   = c.indexOf('\n}', c.indexOf('function statusLabel', oldStart)) + 2;

if (oldStart === -1) {
  console.log('ERROR: statusPillClass not found');
  process.exit(1);
}

console.log('Replacing status functions at char', oldStart, '-', oldEnd);

const newBlock = [
  '// Status resolution per SOP-REPLIERS-API.md sec 8 (locked 2026-08-31)',
  'function resolveStatus(listing) {',
  "  if (!listing) return 'sold';",
  "  if (listing.status === 'A') return 'active';",
  "  if (listing.status === 'U') {",
  "    const last = (listing.lastStatus || '').toLowerCase();",
  "    if (last === 'sc' || last === 'cs') return 'pending';",
  "    if (last === 'ter') return 'terminated';",
  "    return 'terminated';",
  '  }',
  "  return 'terminated';",
  '}',
  '',
  'const STATUS_PILL_CLASS = {',
  "  active:     'pill-active',",
  "  pending:    'pill-pending',",
  "  terminated: 'pill-terminated',",
  "  sold:       'pill-sold',",
  '};',
  '',
  'const STATUS_LABEL = {',
  "  active:     'Active',",
  "  pending:    'Pending',",
  "  terminated: 'Inactive',",
  "  sold:       'Sold',",
  '};',
  '',
  'function statusPillClass(resolvedStatus) {',
  "  return STATUS_PILL_CLASS[resolvedStatus] || 'pill-sold';",
  '}',
  '',
  'function statusLabel(resolvedStatus) {',
  "  return STATUS_LABEL[resolvedStatus] || 'Sold';",
  '}',
].join('\n');

c = c.substring(0, oldStart) + newBlock + c.substring(oldEnd);
fs.writeFileSync(file, c, 'utf8');

// Verify
const c2 = fs.readFileSync(file, 'utf8');
const lines = c2.split('\n');
const idx = lines.findIndex(l => l.includes('function resolveStatus'));
console.log('resolveStatus now at line:', idx + 1);
console.log('STATUS_PILL_CLASS present:', c2.includes('STATUS_PILL_CLASS'));
console.log('Done.');
