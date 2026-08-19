/**
 * generate-auctions.mjs - Sundgren Realty Auctions
 *
 * Fetches live auction data from the BidWrangler API and generates:
 *   - auctions/index.html         (master listing page)
 *   - auctions/{slug}/index.html  (individual SEO-ready auction detail pages)
 *
 * Pages use <!-- HEADER --> and <!-- FOOTER --> placeholders so build.js
 * can inject the site header/footer.
 *
 * State is tracked in auctions/_state.json
 *
 * Usage:
 *   node generate-auctions.mjs            (source mode â€” writes to auctions/, run build.js after)
 *   node generate-auctions.mjs --direct   (direct mode â€” writes assembled pages to dist/)
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BW_BASE_URL = 'https://sundgrenrealty.bidwrangler.com';
const BW_FEED_URL = `${BW_BASE_URL}/api/feed/all`;
const BW_FIELDS   = [
  'type','id','name','status','starts_at','scheduled_end_time','timezone',
  'location','description','simple_description','formatted_simple_description',
  'featured_images','tag_line','items_count','online_only','offline_only',
  'coord_first_name','coord_last_name','coord_phone','coord_email'
].join(',');

const SITE_DOMAIN  = 'https://sundgrenrealty.com';
const AUCTIONS_DIR = path.join(__dirname, 'auctions');
const DIST_DIR     = path.join(__dirname, 'dist');
const STATE_FILE   = path.join(AUCTIONS_DIR, '_state.json');

const DIRECT_MODE = process.argv.includes('--direct');

// Brand colors (Sundgren)
const YELLOW = '#FFD700';

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function slugify(name, id) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60)
    .replace(/-$/, '');
  return `${base}-${id}`;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(str) {
  return String(str || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(str, len) {
  const text = stripHtml(str);
  return text.length > len ? text.substring(0, len - 3) + '...' : text;
}

function isActive(status) {
  return ['active', 'accepting_bids', 'upcoming', 'preview', 'pending', 'scheduled'].includes((status || '').toLowerCase());
}

function statusLabel(status) {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'accepting_bids') return 'ACTIVE';
  if (['upcoming', 'pending', 'scheduled'].includes(s)) return 'UPCOMING';
  if (s === 'preview')   return 'PREVIEW';
  if (['complete', 'completed'].includes(s)) return 'SOLD';
  if (s === 'cancelled') return 'CANCELLED';
  return (status || 'PAST').toUpperCase();
}

function statusPillClass(status) {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'accepting_bids') return 'pill-active';
  if (['upcoming', 'pending', 'scheduled'].includes(s)) return 'pill-upcoming';
  return 'pill-sold';
}

function formatDateTime(isoStr) {
  if (!isoStr) return '';
  try {
    return new Date(isoStr).toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZone: 'America/Chicago', timeZoneName: 'short'
    });
  } catch { return String(isoStr); }
}

function bestImage(images, size = 'lg') {
  if (!images || !images.length) return '';
  const img = images[0];
  return img[size] || img.sm || img.xs || '';
}

// â”€â”€ API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ── Auction Detail API (docs + taxes + earnest) ──────────────────────────────
async function fetchAuctionDetail(id) {
  try {
    const res = await fetch(`${BW_BASE_URL}/api/auctions/${id}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data.items && data.items[0];
    const docs = (item && item.documents) ? item.documents : [];
    const termsText = (data.terms && data.terms.legalese)
      ? data.terms.legalese.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';
    const descText = (data.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const combined = descText + ' ' + termsText;
    const taxMatch     = combined.match(/REAL ESTATE TAXES[^$\n]*\$([0-9,\.]+)/i);
    const earnestMatch = combined.match(/[Ee]arnest money[^$]*\$([0-9,]+)/);
    return {
      docs,
      taxes:   taxMatch     ? '$' + taxMatch[1]     : null,
      earnest: earnestMatch ? '$' + earnestMatch[1] : null,
    };
  } catch { return null; }
}

// ── Document Links ────────────────────────────────────────────────────────────
function renderDocuments(docs) {
  if (!docs || !docs.length) return '';
  const icons = { pdf: 'fa-file-pdf', doc: 'fa-file-word', docx: 'fa-file-word', xls: 'fa-file-excel', xlsx: 'fa-file-excel' };
  const links = docs.map(d => {
    const ext   = (d.file_name || '').split('.').pop().toLowerCase();
    const icon  = icons[ext] || 'fa-file-alt';
    const label = (d.file_name || 'Document').replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '');
    return `<a href="${esc(d.url)}" target="_blank" rel="noopener" class="doc-link">
          <i class="fas ${icon}"></i>
          <span>${esc(label)}</span>
          <i class="fas fa-external-link-alt" style="font-size:10px;opacity:.6;margin-left:auto;"></i>
        </a>`;
  }).join('\n        ');
  return `
    <div class="info-card-docs">
        <h4 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:16px 0 10px;color:var(--dark);padding-top:16px;border-top:1px solid var(--border);"><i class="fas fa-folder-open" style="color:var(--yellow-dark);margin-right:7px;"></i>Documents</h4>
        ${links}
    </div>`;
}

async function fetchAllAuctions() {
  const url = `${BW_FEED_URL}?fields=${BW_FIELDS}&page=1&per_page=100&include_syndicated=true&version=2`;
  const res  = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`BidWrangler API ${res.status}`);
  const data = await res.json();

  const active   = (data.active   || {}).results || [];
  const pastData = data.past || data.complete || {};
  const complete = pastData.results || [];
  const all      = [...active, ...complete];

  // Paginate past if needed
  const total   = pastData.total || pastData.total_count || 0;
  let fetched   = complete.length;
  let page      = 2;
  while (fetched < total && page <= 10) {
    const r = await fetch(
      `${BW_FEED_URL}?fields=${BW_FIELDS}&page=${page}&per_page=100&include_syndicated=true&version=2`,
      { headers: { Accept: 'application/json' } }
    );
    if (!r.ok) break;
    const d  = await r.json();
    const rs = ((d.past || d.complete) || {}).results || [];
    if (!rs.length) break;
    all.push(...rs);
    fetched += rs.length;
    page++;
  }

  console.log(`  BidWrangler: ${active.length} active, ${all.length - active.length} past`);
  return all;
}

// â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch {}
  }
  return { lastFetch: null, auctions: {} };
}

function saveState(state) {
  fs.mkdirSync(AUCTIONS_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// â”€â”€ Photo Grid + Lightbox â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderPhotoGrid(images) {
  if (!images || images.length === 0) return '';
  const srcs = images.slice(0, 20).map(img => img.xl || img.lg || img.sm || img.xs || '').filter(Boolean);
  if (srcs.length === 0) return '';

  const thumbs = srcs.map((src, i) =>
    `        <img src="${esc(src)}" alt="Property photo ${i + 1}" loading="lazy" data-idx="${i}" class="sg-gallery-thumb" tabindex="0">`
  ).join('\n');

  const lightbox = `
    <div id="sg-lightbox" role="dialog" aria-modal="true" aria-label="Photo gallery">
      <button id="sg-lightbox-close" aria-label="Close">&times;</button>
      <button id="sg-lightbox-prev" aria-label="Previous">&#8249;</button>
      <img id="sg-lightbox-img" src="" alt="Property photo">
      <button id="sg-lightbox-next" aria-label="Next">&#8250;</button>
      <span id="sg-lightbox-counter"></span>
    </div>`;

  const script = `
    <script>
    (function(){
      var SRCS=${JSON.stringify(srcs)},cur=0;
      var lb=document.getElementById('sg-lightbox');
      var img=document.getElementById('sg-lightbox-img');
      var counter=document.getElementById('sg-lightbox-counter');
      function show(i){cur=(i+SRCS.length)%SRCS.length;img.src=SRCS[cur];counter.textContent=(cur+1)+' / '+SRCS.length;lb.classList.add('open');document.body.style.overflow='hidden';}
      function close(){lb.classList.remove('open');document.body.style.overflow='';}
      document.querySelectorAll('.sg-gallery-thumb').forEach(function(el){el.addEventListener('click',function(){show(parseInt(el.dataset.idx));});el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' ')show(parseInt(el.dataset.idx));});});
      document.getElementById('sg-lightbox-close').addEventListener('click',close);
      document.getElementById('sg-lightbox-prev').addEventListener('click',function(){show(cur-1);});
      document.getElementById('sg-lightbox-next').addEventListener('click',function(){show(cur+1);});
      lb.addEventListener('click',function(e){if(e.target===lb)close();});
      document.addEventListener('keydown',function(e){if(!lb.classList.contains('open'))return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')show(cur-1);if(e.key==='ArrowRight')show(cur+1);});
    })();
    <\/script>`;

  return `\n    <div class="photo-grid">\n${thumbs}\n    </div>${lightbox}${script}`;
}

// â”€â”€ Info Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// === App Ad =============================================================
function renderAppAd() {
  return [
    '<div class="app-ad">',
    '  <div class="app-ad__eyebrow"><i class="fas fa-mobile-alt"></i> Bid From Your Phone</div>',
    '  <p class="app-ad__body">Download the free Sundgren Realty app to bid, track auctions, and get outbid alerts — right from your pocket.</p>',
    '  <div class="app-ad__badges">',
    '    <a href="https://apps.apple.com/us/app/id1344894378" target="_blank" rel="noopener" class="app-ad__badge app-ad__badge--apple" aria-label="Download on the App Store">',
    '      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>',
    '      <span><small>Download on the</small>App Store</span>',
    '    </a>',
    '    <a href="https://play.google.com/store/apps/details?id=com.bidwrangler.sundgrenrealty&hl=en_US" target="_blank" rel="noopener" class="app-ad__badge app-ad__badge--google" aria-label="Get it on Google Play">',
    '      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M3 20.5v-17c0-.83 1-.83 1.5-.5l15 8.5-15 8.5c-.5.33-1.5.33-1.5-.5z"/></svg>',
    '      <span><small>Get it on</small>Google Play</span>',
    '    </a>',
    '  </div>',
    '</div>'
  ].join('\n');
}

// === Calendar Helpers ====================================================
function toIcsDate(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function renderCalendarButtons(auction) {
  if (!auction.starts_at) return '';

  const titleEnc  = encodeURIComponent(auction.name || 'Sundgren Auction');
  const locationE = encodeURIComponent(auction.location || 'sundgrenrealty.com');
  const descE     = encodeURIComponent('Sundgren Realty & Auction — Register to bid at sundgrenrealty.com/auctions/');

  const startIcs = toIcsDate(auction.starts_at);
  const endIcs   = auction.scheduled_end_time ? toIcsDate(auction.scheduled_end_time) : startIcs;

  const startGcal = new Date(auction.starts_at).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const endGcal   = auction.scheduled_end_time
    ? new Date(auction.scheduled_end_time).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')
    : startGcal;

  const gcalUrl    = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + '&text=' + titleEnc
    + '&dates=' + startGcal + '/' + endGcal
    + '&details=' + descE
    + '&location=' + locationE;

  const outlookUrl = 'https://outlook.live.com/calendar/0/deeplink/compose'
    + '?subject=' + titleEnc
    + '&startdt=' + encodeURIComponent(auction.starts_at)
    + '&enddt='   + encodeURIComponent(auction.scheduled_end_time || auction.starts_at)
    + '&body='    + descE
    + '&location='+ locationE;

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sundgren Realty//Auction//EN',
    'BEGIN:VEVENT',
    'DTSTART:' + startIcs,
    'DTEND:'   + endIcs,
    'SUMMARY:' + (auction.name || 'Sundgren Auction'),
    'DESCRIPTION:Register to bid at sundgrenrealty.com/auctions/',
    'LOCATION:' + (auction.location || 'sundgrenrealty.com'),
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const icsEncoded = encodeURIComponent(icsLines);

  return [
    '<div class="cal-buttons">',
    '  <p><i class="fas fa-calendar-plus"></i>Add to Calendar</p>',
    '  <div class="cal-btn-row">',
    '    <a href="' + gcalUrl + '" target="_blank" rel="noopener" class="cal-btn cal-btn--google">',
    '      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>',
    '      Google',
    '    </a>',
    '    <a href="' + outlookUrl + '" target="_blank" rel="noopener" class="cal-btn cal-btn--outlook">',
    '      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 14a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>',
    '      Outlook',
    '    </a>',
    '    <a href="data:text/calendar;charset=utf-8,' + icsEncoded + '" download="sundgren-auction.ics" class="cal-btn cal-btn--ics">',
    '      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 2v1H7V2H5v1H4a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1V2h-2zm3 7H4V5h1v1h2V5h10v1h2V5h1v4zM6 13h2v2H6zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>',
    '      Apple / iCal',
    '    </a>',
    '  </div>',
    '</div>'
  ].join('\n');
}

function renderInfoCard(auction, detail) {
  const active  = isActive(auction.status);
  const startDt = formatDateTime(auction.starts_at);
  const endDt   = formatDateTime(auction.scheduled_end_time);
  const bwUrl   = `${BW_BASE_URL}/ui/auctions/${auction.id}`;
  const phone   = auction.coord_phone || '316-321-7112';

  const taxes   = detail && detail.taxes   ? detail.taxes   : null;
  const earnest = detail && detail.earnest ? detail.earnest : null;

  const financialRows = [
    taxes   ? `<li><i class="fas fa-receipt"></i><div><span class="mlabel">Est. Taxes</span>${esc(taxes)}/yr</div></li>` : '',
    earnest ? `<li><i class="fas fa-hand-holding-usd"></i><div><span class="mlabel">Earnest Money</span>${esc(earnest)}</div></li>` : '',
  ].filter(Boolean).join('\n            ');

  const docsHtml = detail && detail.docs && detail.docs.length ? renderDocuments(detail.docs) : '';

  const cta = active
    ? `        <a href="${bwUrl}" class="btn-bid" target="_blank" rel="noopener">Register to Bid &rarr;</a>
        <a href="/auctions/" class="btn-all">&larr; All Auctions</a>`
    : `        <p style="font-size:13px;color:var(--text-light);margin-top:16px;text-align:center;">This auction has closed.</p>
        <a href="/auctions/" class="btn-bid">View Active Auctions &rarr;</a>`;

  return `    <div class="info-card">
        <h4>Auction Details</h4>
        <ul class="meta-list">
            ${startDt ? `<li><i class="fas fa-calendar-alt"></i><div><span class="mlabel">Starts</span>${esc(startDt)}</div></li>` : ''}
            ${endDt   ? `<li><i class="fas fa-flag-checkered"></i><div><span class="mlabel">Closes</span>${esc(endDt)}</div></li>` : ''}
            <li><i class="fas fa-gavel"></i><div><span class="mlabel">Status</span>${esc(statusLabel(auction.status))}</div></li>
            ${auction.online_only ? `<li><i class="fas fa-laptop"></i><div><span class="mlabel">Format</span>Online Only</div></li>` : ''}
            ${financialRows}
            <li><i class="fas fa-phone"></i><div><span class="mlabel">Questions?</span><a href="tel:${phone.replace(/\D/g,'')}" style="color:var(--yellow-dark);">${esc(phone)}</a></div></li>
        </ul>
${cta}
${active ? renderCalendarButtons(auction) : ''}
${renderAppAd()}
${docsHtml}
    </div>`;
}

// â”€â”€ Description Parser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function parseDescription(raw) {
  // 1. Strip HTML tags
  let text = String(raw || '').replace(/<[^>]+>/g, ' ');
  // 2. Fix encoding artifacts
  text = text
    .replace(/\u00c2\u00a0/g, ' ')
    .replace(/\u00c2/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();

  function escH(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // 3. CSS (injected once)
  const css = `<style>
    .desc-section { margin-bottom:18px; padding:16px 20px; background:var(--bg-light); border-radius:8px; border-left:4px solid var(--yellow); }
    .desc-section:last-child { margin-bottom:0; }
    .desc-section-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--dark); margin:0 0 10px; display:flex; align-items:center; gap:8px; }
    .desc-section-title i { color:var(--yellow-dark); font-size:13px; }
    .desc-section p { font-size:14px; line-height:1.75; color:var(--text); margin:0; }
    .desc-section ul { margin:0; padding-left:0; list-style:none; display:flex; flex-direction:column; gap:6px; }
    .desc-section ul li { display:flex; align-items:flex-start; gap:8px; font-size:14px; line-height:1.6; color:var(--text); }
    .desc-section ul li::before { content:''; display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--yellow); flex-shrink:0; margin-top:6px; }
    .desc-sellers { font-size:13px; color:var(--text-light); margin:0 0 16px; font-style:italic; }
    .desc-online-note { display:flex; align-items:center; gap:8px; background:#fff8e1; border:1px solid var(--yellow); border-radius:6px; padding:10px 14px; font-size:13px; color:var(--dark); margin-bottom:16px; }
    .desc-online-note i { color:var(--yellow-dark); }
    .lot-table { width:100%; border-collapse:collapse; font-size:14px; }
    .lot-table th { background:var(--dark); color:#fff; padding:8px 12px; text-align:left; font-size:12px; text-transform:uppercase; letter-spacing:.05em; }
    .lot-table td { padding:8px 12px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:top; }
    .lot-table tr:last-child td { border-bottom:none; }
    .lot-table tr:nth-child(even) td { background:#f9f9f9; }
  </style>`;

  // 4. Split on ALL section-heading patterns found in Sundgren descriptions.
  //    Also "Auction Date:" and "Auction Location:" as top-level key-facts.
  //    NOTE: LAND LOCATION FROM X: uses a greedy match captured separately.

  // Use a simple split approach: find all section markers
  // Order matters — longer/more-specific patterns first
  const markerRe = /(PROPERTY DESCRIPTION|PROPERTY ADDRESS|LEGAL DESCRIPTION|LAND FEATURES|LAND LOCATION FROM[^:]{0,60}|LAND LOCATION[^:]{0,40}|REAL ESTATE TAXES|MANNER OF AUCTION|PERSONAL PROPERTY AUCTION|TRACTS?\s+[\d,&\s]+LOCATION FROM[^:]{0,40}|TRACT \d+[^:]{0,30}|TERMS|PICKUP|REMOVAL|PAYMENT|PREVIEW|INSPECTION|BIDDING|SHIPPING|NOTES?|DIRECTIONS?):/g;
  const parts = text.split(markerRe);
  // parts alternates: [preText, LABEL, body, LABEL, body, ...]

  let preText = parts[0].trim();
  const namedSections = [];
  for (let j = 1; j < parts.length; j += 2) {
    namedSections.push({ title: parts[j].trim(), body: (parts[j+1] || '').trim() });
  }

  // 5b. Extract OPEN HOUSE entries from preText (before further parsing)
  // Flat text: split on each "OPEN HOUSE" boundary, stop before the next one or a section keyword
  const openHouseLines = [];
  preText = preText.replace(/OPEN HOUSE\s+[^O][^P]?[^E]?[^N]?(?:(?!OPEN HOUSE|PROPERTY|LEGAL|LAND|TERMS|TRACT|MANNER|PERSONAL).)*?(?=OPEN HOUSE|PROPERTY|LEGAL|LAND|TERMS|TRACT|MANNER|PERSONAL|$)/gi, (match) => {
    const clean = match.trim();
    if (clean) openHouseLines.push(clean);
    return '';
  });

  // 6. Parse preText: extract "Auction Date: X" and "Auction Location: Y"
  //    Then detect online-only note and sellers line.
  let auctionDate = '';
  let auctionLocation = '';
  let onlineOnly = false;
  let sellers = '';
  let freeText = preText;

  // Extract Auction Date:
  freeText = freeText.replace(/Auction Date:\s*([^A-Z][^:]*?)(?=Auction Location:|$)/i, (_, v) => {
    auctionDate = v.trim();
    return '';
  });
  // Extract Auction Location:
  freeText = freeText.replace(/Auction Location:\s*(.*?)(?=Auction Date:|$)/i, (_, v) => {
    auctionLocation = v.trim();
    return '';
  });
  // If neither matched inline, try simpler
  if (!auctionDate) {
    freeText = freeText.replace(/Auction Date:\s*(.+)/i, (_, v) => { auctionDate = v.trim(); return ''; });
  }
  if (!auctionLocation) {
    freeText = freeText.replace(/Auction Location:\s*(.+)/i, (_, v) => { auctionLocation = v.trim(); return ''; });
  }

  // Detect "ONLINE ONLY AUCTION: Download The Sundgren Realty App Today!"
  if (/ONLINE ONLY AUCTION/i.test(freeText) || /ONLINE ONLY AUCTION/i.test(auctionLocation)) {
    onlineOnly = true;
    freeText = freeText.replace(/ONLINE ONLY AUCTION:\s*Download[^.!]*[.!]?/gi, '').trim();
    auctionLocation = auctionLocation.replace(/ONLINE ONLY AUCTION:\s*Download[^.!]*[.!]?/gi, '').trim();
    auctionLocation = auctionLocation.replace(/^ONLINE ONLY AUCTION[:\s]*/i, '').trim();
  }

  // Extract sellers line from auctionLocation or freeText.
  // Pattern: "Estate of X, Seller" or "JBAR LLC, Seller" at END of the location string,
  // OR as standalone text in freeText. Use an end-anchor to avoid swallowing the full address.
  // Narrow seller name: ends with LLC, Inc, Trust, or is "Estate of ...", or is a short name.
  const sellerRe = /\b((?:Estate of [A-Za-z .'-]+|[A-Z][A-Za-z .'-]+(?:\s+(?:LLC|Inc|Trust|Co))?)),\s*Sellers?\s*$/i;
  const sellersAtEnd = auctionLocation.match(sellerRe);
  if (sellersAtEnd) {
    sellers = sellersAtEnd[1].trim() + ', Sellers';
    auctionLocation = auctionLocation.slice(0, sellersAtEnd.index).trim();
  } else {
    // Try in freeText (sellers sometimes appear there)
    const sellersInFree = freeText.match(sellerRe);
    if (sellersInFree) {
      sellers = sellersInFree[1].trim() + ', Sellers';
      freeText = freeText.replace(sellersInFree[0], '').trim();
    }
  }
  freeText = freeText.replace(/\s{2,}/g, ' ').trim();

  // 7. Build HTML
  let html = css;

  // Online-only note
  if (onlineOnly) {
    html += `\n<div class="desc-online-note"><i class="fas fa-laptop"></i> <span>Online Only Auction &mdash; Download the Sundgren Realty App to bid.</span></div>`;
  }

  // Sellers line
  if (sellers) {
    html += `\n<p class="desc-sellers"><i class="fas fa-user" style="margin-right:6px;color:var(--yellow-dark);"></i>${escH(sellers)}</p>`;
  }

  // Open Houses (if any)
  if (openHouseLines.length > 0) {
    if (openHouseLines.length === 1) {
      html += `\n<div class="desc-section">
  <h3 class="desc-section-title"><i class="fas fa-door-open"></i> Open House</h3>
  <p>${escH(openHouseLines[0].replace(/^OPEN HOUSE\s*/i, ''))}</p>
</div>`;
    } else {
      const items = openHouseLines.map(l => `<li>${escH(l.replace(/^OPEN HOUSE\s*/i, ''))}</li>`).join('\n      ');
      html += `\n<div class="desc-section">
  <h3 class="desc-section-title"><i class="fas fa-door-open"></i> Open Houses</h3>
  <ul>\n      ${items}\n    </ul>
</div>`;
    }
  }

  // Auction Location (only if meaningful — not just a sellers line or empty)
  if (auctionLocation && !/^online only$/i.test(auctionLocation)) {
    html += `\n<div class="desc-section" style="margin-bottom:18px;">
  <h3 class="desc-section-title"><i class="fas fa-map-marker-alt"></i> Auction Location</h3>
  <p>${escH(auctionLocation)}</p>
</div>`;
  }

  // Free text (anything remaining before named sections)
  if (freeText.length > 5) {
    html += `\n<p style="margin-bottom:14px;font-size:14px;line-height:1.75;color:var(--text);">${escH(freeText)}</p>`;
  }

  // 8. Icon map for named sections
  const iconMap = {
    'PROPERTY DESCRIPTION': 'fa-home',
    'PROPERTY ADDRESS': 'fa-map-marker-alt',
    'LEGAL DESCRIPTION': 'fa-file-alt',
    'LAND FEATURES': 'fa-seedling',
    'REAL ESTATE TAXES': 'fa-receipt',
    'MANNER OF AUCTION': 'fa-gavel',
    'PERSONAL PROPERTY AUCTION': 'fa-boxes',
    'TRACT': 'fa-map',
    'TERMS': 'fa-file-contract',
    'PICKUP': 'fa-box-open', 'REMOVAL': 'fa-box-open',
    'PAYMENT': 'fa-credit-card',
    'PREVIEW': 'fa-eye', 'INSPECTION': 'fa-eye',
    'BIDDING': 'fa-gavel',
    'SHIPPING': 'fa-truck',
    'NOTE': 'fa-info-circle', 'NOTES': 'fa-info-circle',
    'DIRECTIONS': 'fa-road',
    'LAND LOCATION': 'fa-directions',
  };

  // Title display (Title Case for multi-word, sentence case otherwise)
  function titleCase(s) {
    return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  // 9. Group sections: TRACT N = tract overview, TRACTS X LOCATION FROM Y = direction, LAND LOCATION FROM X = direction
  const tractSections = namedSections.filter(s => /^TRACT \d/i.test(s.title));
  const landLocSections = namedSections.filter(s =>
    /^LAND LOCATION FROM/i.test(s.title) || /^TRACTS?\s+[\d,&\s]+LOCATION FROM/i.test(s.title)
  );
  const regularSections = namedSections.filter(s =>
    !tractSections.includes(s) && !landLocSections.includes(s)
  );

  // Render LAND LOCATION FROM sections as a single grouped card
  if (landLocSections.length > 0) {
    const items = landLocSections.map(s =>
      `<li><strong>${escH(titleCase(s.title.replace(/_/g,' ')))}</strong> &mdash; ${escH(s.body)}</li>`
    ).join('\n      ');
    html += `\n<div class="desc-section">
  <h3 class="desc-section-title"><i class="fas fa-directions"></i> Directions</h3>
  <ul>\n      ${items}\n    </ul>
</div>`;
  }

  // Render TRACT sections as a single grouped card
  if (tractSections.length > 0) {
    const items = tractSections.map(s =>
      `<li><strong>${escH(titleCase(s.title.replace(/_/g,' ')))}</strong> &mdash; ${escH(s.body)}</li>`
    ).join('\n      ');
    html += `\n<div class="desc-section">
  <h3 class="desc-section-title"><i class="fas fa-map"></i> Tract Overview</h3>
  <ul>\n      ${items}\n    </ul>
</div>`;
  }

  // 10. Render remaining named sections
  for (const sec of regularSections) {
    const body = sec.body.trim();
    if (!body) continue;

    // Determine icon
    const titleUpper = sec.title.toUpperCase();
    const iconKey = Object.keys(iconMap).find(k => titleUpper.startsWith(k)) || null;
    const icon = iconKey ? iconMap[iconKey] : 'fa-info-circle';
    const titleDisplay = titleCase(sec.title.replace(/_/g,' '));

    // Skip PROPERTY ADDRESS — duplicates the page title
    if (titleUpper === 'PROPERTY ADDRESS') continue;

    // Classify section
    const isLegal = titleUpper.includes('LEGAL');
    const isTax = titleUpper.includes('TAX');

    let bodyHtml;
    if (isLegal) {
      bodyHtml = `<p style="font-size:13px;color:var(--text-light);line-height:1.7;">${escH(body)}</p>`;
    } else if (isTax) {
      bodyHtml = `<p style="font-size:15px;font-weight:700;color:var(--dark);">${escH(body)}</p>`;
    } else {
      bodyHtml = `<p>${escH(body)}</p>`;
    }

    html += `\n<div class="desc-section">
  <h3 class="desc-section-title"><i class="fas ${icon}"></i> ${escH(titleDisplay)}</h3>
  ${bodyHtml}
</div>`;
  }

  return html || '<p>Contact Sundgren Realty for more information about this auction.</p>';
}


function renderAuctionPage(auction) {
  const slug      = slugify(auction.name, auction.id);
  const heroImg   = bestImage(auction.featured_images, 'lg');
  const ogImg     = bestImage(auction.featured_images, 'xl') || heroImg;
  const metaTitle = `${auction.name || 'Auction'} | Sundgren Realty &amp; Auction`;
  const descText  = truncate(auction.simple_description || auction.description || '', 160);
  const metaDesc  = descText || 'Real estate auction in South Central Kansas. Sundgren Realty &amp; Auction, El Dorado, KS.';
  const pillClass = statusPillClass(auction.status);
  const sLabel    = statusLabel(auction.status);
  const active    = isActive(auction.status);
  const canonical = `${SITE_DOMAIN}/auctions/${slug}/`;

  const heroStyle = heroImg
    ? `style="background-image:url('${esc(heroImg)}')" `
    : `style="background:var(--dark);" `;

  const soldBanner = !active
    ? `\n    <div class="sold-banner">
        <p><i class="fas fa-gavel" style="color:${YELLOW};margin-right:10px;"></i>This auction has closed. Thank you to all who participated.</p>
        <a href="/auctions/" class="btn-go">View Active Auctions &rarr;</a>
    </div>` : '';

  // Use structured parser for all description sources
  const rawDesc = auction.simple_description || auction.description || '';
  const descHtml = rawDesc ? parseDescription(rawDesc) : '<p>Contact Sundgren Realty for more information about this auction.</p>';

  const photoGrid = renderPhotoGrid(auction.featured_images);
  const infoCard  = renderInfoCard(auction, auction._detail || null);
  const bwUrl     = `${BW_BASE_URL}/ui/auctions/${auction.id}`;

  // BW mock embed
  const heroImg2  = bestImage(auction.featured_images, 'lg') || bestImage(auction.featured_images, 'sm') || '';
  const thumbImgs = (auction.featured_images || []).slice(0, 4).map(img => img.sm || img.xs || '').filter(Boolean);
  const thumbsHtml = thumbImgs.map(src =>
    `<div style="width:80px;height:54px;flex-shrink:0;border-radius:4px;overflow:hidden;border:2px solid transparent;cursor:pointer;" onclick="setBwMain('${esc(src)}')"><img src="${esc(src)}" style="width:100%;height:100%;object-fit:cover;"></div>`
  ).join('');
  const endDtRaw   = auction.scheduled_end_time ? new Date(auction.scheduled_end_time) : null;
  const endDtLabel = endDtRaw ? endDtRaw.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Chicago'}) : '';
  const coordName  = [auction.coord_first_name, auction.coord_last_name].filter(Boolean).join(' ');
  const coordPhone = auction.coord_phone || '';
  const coordEmail = auction.coord_email || '';

  const bwEmbed = `
    <section class="section" style="background:var(--bg-light);padding-top:0;">
        <div class="container">
            <h2 style="font-size:18px;font-weight:800;color:var(--dark);margin:0 0 16px;padding-bottom:10px;border-bottom:2px solid ${YELLOW};"><i class="fas fa-gavel" style="color:${YELLOW};margin-right:8px;"></i>Online Bidding</h2>
            <div style="border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);background:#fff;">
                <!-- BW mock header -->
                <div style="background:${YELLOW};padding:10px 18px;display:flex;align-items:center;justify-content:space-between;">
                    <span style="font-weight:900;font-size:16px;letter-spacing:.04em;color:#1a1a1a;">SUNDGREN REALTY<span style="font-size:10px;vertical-align:super;">&trade;</span></span>
                    <span style="font-size:12px;color:#1a1a1a;opacity:.7;">powered by BidWrangler</span>
                </div>
                <!-- BW mock body -->
                <div style="display:flex;gap:0;flex-wrap:wrap;">
                    <!-- Photo col -->
                    <div style="flex:0 0 45%;min-width:280px;background:#111;">
                        <div style="position:relative;height:260px;overflow:hidden;background:#1a1a1a;">
                            ${heroImg2 ? `<img id="bw-main-img" src="${esc(heroImg2)}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="fas fa-image" style="font-size:48px;color:#444;"></i></div>`}
                        </div>
                        ${thumbsHtml ? `<div style="display:flex;gap:6px;padding:8px;overflow-x:auto;background:#111;">${thumbsHtml}</div>` : ''}
                    </div>
                    <!-- Info col -->
                    <div style="flex:1;min-width:280px;padding:20px 24px;">
                        <p style="font-size:12px;color:#888;margin:0 0 6px;">by Sundgren Auction &amp; Realty</p>
                        <h3 style="font-size:17px;font-weight:800;color:#1a1a1a;margin:0 0 12px;line-height:1.3;">${esc(auction.name || 'Auction')}</h3>
                        ${endDtLabel ? `<div style="display:inline-block;background:#f0f4ff;border-radius:20px;padding:5px 14px;font-size:13px;font-weight:700;color:#1a3a8a;margin-bottom:14px;"><i class="fas fa-clock" style="margin-right:6px;"></i>Ends ${esc(endDtLabel)}</div>` : ''}
                        <a href="${esc(bwUrl)}" target="_blank" rel="noopener"
                           style="display:block;width:100%;background:#1a3a8a;color:#fff;text-align:center;padding:14px;border-radius:6px;font-size:15px;font-weight:800;text-decoration:none;letter-spacing:.03em;margin-bottom:16px;">
                            REGISTER TO BID
                        </a>
                        <div style="display:flex;gap:0;border-bottom:2px solid #eee;margin-bottom:14px;">
                            <span style="padding:8px 16px;font-size:13px;font-weight:700;color:#1a3a8a;border-bottom:2px solid #1a3a8a;margin-bottom:-2px;">DETAILS</span>
                            <span style="padding:8px 16px;font-size:13px;font-weight:600;color:#888;">CONTACT</span>
                            ${auction._detail && auction._detail.docs && auction._detail.docs.length ? `<span style="padding:8px 16px;font-size:13px;font-weight:600;color:#888;">DOCUMENTS</span>` : ''}
                        </div>
                        <div style="font-size:13px;color:#444;line-height:1.7;">
                            ${coordName ? `<p style="margin:0 0 4px;"><i class="fas fa-user" style="color:#888;width:16px;margin-right:6px;"></i>${esc(coordName)}</p>` : ''}
                            ${coordPhone ? `<p style="margin:0 0 4px;"><i class="fas fa-phone" style="color:#888;width:16px;margin-right:6px;"></i>${esc(coordPhone)}</p>` : ''}
                            ${coordEmail ? `<p style="margin:0;"><i class="fas fa-envelope" style="color:#888;width:16px;margin-right:6px;"></i>${esc(coordEmail)}</p>` : ''}
                        </div>
                    </div>
                </div>
                <!-- BW mock footer -->
                <div style="padding:10px 18px;background:#f7f7f7;border-top:1px solid #eee;text-align:center;">
                    <a href="${esc(bwUrl)}" target="_blank" rel="noopener" style="font-size:13px;color:#1a3a8a;font-weight:700;text-decoration:none;">Open full bidding experience on BidWrangler &rarr;</a>
                </div>
            </div>
        </div>
    </section>
    <script>function setBwMain(src){var el=document.getElementById('bw-main-img');if(el)el.src=src;}<\/script>`;

  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: auction.name || undefined,
    startDate: auction.starts_at || undefined,
    endDate: auction.scheduled_end_time || undefined,
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    eventStatus: active ? 'https://schema.org/EventScheduled' : 'https://schema.org/EventEnded',
    image: ogImg ? [ogImg] : undefined,
    description: metaDesc,
    organizer: { '@type': 'Organization', name: 'Sundgren Realty &amp; Auction', url: SITE_DOMAIN }
  }, null, 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(metaTitle)}</title>
  <meta name="description" content="${esc(metaDesc)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:title" content="${esc(metaTitle)}">
  <meta property="og:description" content="${esc(metaDesc)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(canonical)}">
  ${ogImg ? `<meta property="og:image" content="${esc(ogImg)}">
  <meta property="og:image:secure_url" content="${esc(ogImg)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${esc(ogImg)}">` : `<meta property="og:image" content="https://sundgren-realty.pages.dev/images/og-preview.png">
  <meta property="og:image:secure_url" content="https://sundgren-realty.pages.dev/images/og-preview.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://sundgren-realty.pages.dev/images/og-preview.png">`}
  <script type="application/ld+json">${schema}</script>
  <!-- SCHEMA:BreadcrumbList -->
  <link rel="icon" href="/images/favicon-black.png" type="image/png" media="(prefers-color-scheme: light)">
  <link rel="icon" href="/images/favicon.png" type="image/png" media="(prefers-color-scheme: dark)">
  <link rel="apple-touch-icon" href="/images/favicon.png">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="/css/sundgren.css">
</head>
<body>

<!-- HEADER -->

<main>

    <section class="auction-hero" ${heroStyle}>
        <div class="hero-inner">
            <div class="container">
                <div style="max-width:700px;margin:0 auto;text-align:center;">
                    <span class="pill ${pillClass}">${sLabel}</span>
                    <h1 style="color:#fff;font-size:clamp(22px,4vw,38px);font-weight:900;margin:0 0 10px;line-height:1.2;">${esc(auction.name || 'Real Estate Auction')}</h1>
                    <nav aria-label="Breadcrumb" style="margin-top:16px;">
                        <ol class="breadcrumb">
                            <li><a href="/">Home</a></li>
                            <li><a href="/auctions/">Auctions</a></li>
                            <li class="active">${esc((auction.name || 'Auction').substring(0, 40))}</li>
                        </ol>
                    </nav>
                </div>
            </div>
        </div>
    </section>
${soldBanner}

    <section class="section">
        <div class="container">
            <div class="auction-detail-grid">
                <div>
                    <h2 style="font-size:20px;font-weight:800;color:var(--dark);margin:0 0 16px;padding-bottom:10px;border-bottom:2px solid ${YELLOW};">About This Auction</h2>
                    ${photoGrid}
                    <div style="color:var(--text);line-height:1.8;margin-top:${photoGrid ? '24px' : '0'}">
                        ${descHtml}
                    </div>
                </div>
                <div>
${infoCard}
                </div>
            </div>
        </div>
    </section>
${bwEmbed}

    <section class="cta-dark">
        <div class="container">
            <h2>Looking for More Opportunities?</h2>
            <p>Browse all active and past real estate auctions from Sundgren Realty &amp; Auction in South Central Kansas.</p>
            <a href="/auctions/" class="btn-yellow">View All Auctions</a>
            <a href="/contact-us/" class="btn-outline-white">Contact Us</a>
        </div>
    </section>

</main>

<!-- FOOTER -->

</body>
</html>
`;
}

// â”€â”€ Auction Index Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderCard(auction, slug) {
  const imgUrl   = bestImage(auction.featured_images, 'sm');
  const endDt    = formatDateTime(auction.scheduled_end_time);
  const active   = isActive(auction.status);
  const status   = (auction.status || '').toLowerCase();
  const badgeCls = active ? (status === 'accepting_bids' || status === 'active' ? 'active' : 'upcoming') : 'sold';
  const badgeLbl = statusLabel(auction.status);

  const imgStyle = imgUrl
    ? `style="background-image:url('${esc(imgUrl)}')"` : '';
  const soldOverlay = !active ? `<div class="sold-overlay"><span>SOLD</span></div>` : '';

  return `        <a href="/auctions/${esc(slug)}/" class="auction-card-wrap" id="card-${auction.id}">
                <div class="auction-card">
                    <div class="auction-card-img" ${imgStyle}>
                        <span class="auction-card-badge ${badgeCls}">${badgeLbl}</span>
                        ${soldOverlay}
                    </div>
                    <div class="auction-card-body">
                        <p class="auction-card-title">${esc(auction.name || 'Auction')}</p>
                        ${endDt ? `<p class="auction-card-meta"><i class="fas fa-calendar-alt"></i>Auction Ends: ${esc(endDt)}</p>` : ''}
                        ${auction.online_only ? `<p class="auction-card-meta"><i class="fas fa-laptop"></i>Online Only</p>` : ''}
                        <span class="auction-card-more">View Details &rarr;</span>
                    </div>
                </div>
            </a>`;
}

function renderIndexPage(auctions, stateAuctions) {
  const active = auctions.filter(a => isActive(a.status));
  const past   = auctions.filter(a => !isActive(a.status));

  // Build map pin data for active auctions
  const mapPins = active
    .map((a, i) => {
      const loc = a.location;
      if (!loc || !loc.lat || !loc.lng) return null;
      const slug = stateAuctions[String(a.id)]?.slug || slugify(a.name, a.id);
      const endDt = a.scheduled_end_time ? new Date(a.scheduled_end_time).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'America/Chicago' }) : '';
      return {
        id: `card-${a.id}`,
        lat: parseFloat(loc.lat),
        lng: parseFloat(loc.lng),
        title: a.name,
        city: loc.city || '',
        state: loc.state || '',
        date: endDt,
        url: `/auctions/${slug}/`,
        index: i
      };
    })
    .filter(Boolean);

  const mapPinsJson = JSON.stringify(mapPins);

  const activeCards = active.length
    ? active.map((a, i) => renderCard(a, stateAuctions[String(a.id)]?.slug || slugify(a.name, a.id))).join('\n')
    : `        <div style="grid-column:1/-1;text-align:center;padding:48px 0;">
            <i class="fas fa-gavel" style="font-size:48px;color:#ddd;margin-bottom:16px;display:block;"></i>
            <p style="color:var(--text-light);">No active auctions at this time. <a href="/contact-us/" style="color:#c00;">Contact us</a> to be notified of upcoming opportunities.</p>
        </div>`;

  const pastCards = past.slice(0, 24)
    .map(a => renderCard(a, stateAuctions[String(a.id)]?.slug || slugify(a.name, a.id))).join('\n');

  const pastSection = past.length ? `
    <section class="section" style="background:var(--bg-light);padding-top:0;">
        <div class="container">
            <div class="section-title">
                <span class="eyebrow">Archives</span>
                <h2>Past Auctions</h2>
                <hr class="divider">
                <p>Sold properties below. Each page includes property details, photos, and description.</p>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px;">
${pastCards}
            </div>
        </div>
    </section>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auctions | Sundgren Realty &amp; Auction | El Dorado, KS</title>
  <meta name="description" content="Browse active and upcoming real estate auctions from Sundgren Realty &amp; Auction in South Central Kansas. Farm, land, residential, and personal property auctions.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${SITE_DOMAIN}/auctions/">
  <meta property="og:title" content="Auctions | Sundgren Realty &amp; Auction | El Dorado, KS">
  <meta property="og:description" content="Active and upcoming real estate auctions in South Central Kansas from Sundgren Realty.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${SITE_DOMAIN}/auctions/">
  <meta property="og:image" content="https://sundgren-realty.pages.dev/images/og-preview.png">
  <meta property="og:image:secure_url" content="https://sundgren-realty.pages.dev/images/og-preview.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://sundgren-realty.pages.dev/images/og-preview.png">
  <!-- SCHEMA:BreadcrumbList -->
  <link rel="icon" href="/images/favicon-black.png" type="image/png" media="(prefers-color-scheme: light)">
  <link rel="icon" href="/images/favicon.png" type="image/png" media="(prefers-color-scheme: dark)">
  <link rel="apple-touch-icon" href="/images/favicon.png">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="/css/sundgren.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <style>
    .sg-view-toggle { display:flex; gap:8px; justify-content:flex-end; margin-bottom:24px; }
    .sg-view-btn { display:inline-flex; align-items:center; gap:7px; padding:8px 20px; border-radius:6px; font-size:13px; font-weight:700; cursor:pointer; border:2px solid var(--dark); background:#fff; color:var(--dark); transition:all .15s; text-decoration:none; }
    .sg-view-btn.active { background:var(--dark); color:#FFD700; border-color:var(--dark); }
    .sg-view-btn:hover:not(.active) { background:var(--bg-light); color:var(--dark); text-decoration:none; }
    .sg-map-layout { display:none; }
    .sg-map-layout.visible { display:flex; gap:0; align-items:flex-start; }
    .sg-map-col { position:sticky; top:84px; flex:0 0 45%; height:calc(100vh - 110px); max-height:680px; border-radius:10px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.12); }
    #sg-map { height:100%; min-height:400px; width:100%; display:block; }
    .leaflet-container img { max-width:none !important; max-height:none !important; }
    .leaflet-tile { max-width:none !important; width:256px !important; height:256px !important; }
    .sg-grid-col { flex:1; overflow-y:auto; max-height:calc(100vh - 110px); padding-left:24px; }
    .sg-grid-col::-webkit-scrollbar { width:5px; }
    .sg-grid-col::-webkit-scrollbar-thumb { background:#FFD700; border-radius:3px; }
    .auction-card-wrap.pin-active .auction-card { outline:3px solid #FFD700; outline-offset:2px; box-shadow:0 8px 32px rgba(255,215,0,.3) !important; }
    .sg-past-hidden { display:none !important; }
    @media(max-width:900px) {
      .sg-map-layout.visible { flex-direction:column; }
      .sg-map-col { position:static; flex:none; width:100%; height:320px; max-height:320px; }
      .sg-grid-col { padding-left:0; max-height:none; overflow-y:visible; }
    }
  </style>
</head>
<body>

<!-- HEADER -->

<main>

    <section class="page-hero">
        <div class="inner">
            <h1>Auctions</h1>
            <nav aria-label="Breadcrumb">
                <ol class="breadcrumb">
                    <li><a href="/">Home</a></li>
                    <li class="active">Auctions</li>
                </ol>
            </nav>
        </div>
    </section>

    <section class="section" id="active-section">
        <div class="container">
            <div class="section-title">
                <span class="eyebrow">Active &amp; Upcoming</span>
                <h2>Current Auctions</h2>
                <hr class="divider">
                <p>Browse live auction opportunities from Sundgren Realty &amp; Auction. Click any listing for full details, photos, and online bidding.</p>
            </div>

            <!-- Grid / Map toggle -->
            <div class="sg-view-toggle">
                <button class="sg-view-btn active" id="btn-grid" onclick="setView('grid')">
                    <i class="fas fa-th"></i> Grid
                </button>
                <button class="sg-view-btn" id="btn-map" onclick="setView('map')">
                    <i class="fas fa-map-marker-alt"></i> Map
                </button>
            </div>

            <!-- Map layout (hidden until map mode) -->
            <div class="sg-map-layout" id="map-layout">
                <div class="sg-map-col">
                    <div id="sg-map"></div>
                </div>
                <div class="sg-grid-col">
                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px;" id="map-grid-cards">
${activeCards}
                    </div>
                </div>
            </div>

            <!-- Grid layout (default) -->
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px;" id="grid-cards">
${activeCards}
            </div>
        </div>
    </section>

    <section style="background:var(--dark);padding:48px 0;">
      <div class="container">
        <div style="display:flex;align-items:center;gap:48px;flex-wrap:wrap;justify-content:center;">
          <div style="flex:0 1 420px;">
            <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--yellow);margin:0 0 8px;"><i class="fas fa-mobile-alt" style="margin-right:6px;"></i>Bid From Your Phone</p>
            <h2 style="font-family:'Trajan Pro',serif;font-size:22px;font-weight:700;color:#fff;margin:0 0 8px;text-transform:uppercase;letter-spacing:.04em;">Download the Sundgren Realty App</h2>
            <p style="font-size:14px;color:rgba(255,255,255,.75);margin:0 0 24px;line-height:1.6;">Bid on auctions, track properties, and get outbid alerts &mdash; right from your pocket. Free on iOS and Android.</p>
            <img src="/images/sundgren-app-mockup.png" alt="Sundgren Realty app on mobile" style="display:block;max-width:180px;width:100%;margin:0 0 24px;filter:drop-shadow(0 8px 24px rgba(0,0,0,.5));">
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <a href="https://apps.apple.com/us/app/id1344894378" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:10px;background:#fff;color:var(--dark);padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                <span style="display:flex;flex-direction:column;line-height:1.2;"><small style="font-size:10px;font-weight:400;opacity:.7;">Download on the</small>App Store</span>
              </a>
              <a href="https://play.google.com/store/apps/details?id=com.bidwrangler.sundgrenrealty&hl=en_US" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:10px;background:#fff;color:var(--dark);padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M3 20.5v-17c0-.83 1-.83 1.5-.5l15 8.5-15 8.5c-.5.33-1.5.33-1.5-.5z"/></svg>
                <span style="display:flex;flex-direction:column;line-height:1.2;"><small style="font-size:10px;font-weight:400;opacity:.7;">Get it on</small>Google Play</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

${pastSection}

    <section class="cta-dark">
        <div class="container">
            <h2>Have a Property to Auction?</h2>
            <p>Sundgren Realty &amp; Auction handles every sale with transparency and a commitment to getting sellers the best outcome.</p>
            <a href="/contact-us/" class="btn-yellow">Contact Our Team</a>
        </div>
    </section>

</main>

<!-- FOOTER -->

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
const AUCTION_PINS = ${mapPinsJson};
let map = null, markers = {}, activeMarker = null;

function goldIcon() {
  return L.divIcon({ className:'', html:'<div style="width:34px;height:34px;background:#1a1a1a;border:3px solid #FFD700;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,.3);"></div>', iconSize:[34,34], iconAnchor:[17,34], popupAnchor:[0,-36] });
}
function goldIconActive() {
  return L.divIcon({ className:'', html:'<div style="width:40px;height:40px;background:#FFD700;border:3px solid #1a1a1a;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 12px rgba(255,215,0,.6);"></div>', iconSize:[40,40], iconAnchor:[20,40], popupAnchor:[0,-42] });
}

function initMap() {
  if (map) return;
  map = L.map('sg-map', { zoomControl:true, scrollWheelZoom:false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution:'&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    subdomains:'abcd', maxZoom:19
  }).addTo(map);

  var bounds = [];
  AUCTION_PINS.forEach(function(pin) {
    var gi = goldIcon();
    var m = L.marker([pin.lat, pin.lng], { icon: gi })
      .bindPopup(
        '<div style="min-width:190px;">'
        + '<strong style="font-size:13px;display:block;margin-bottom:4px;">' + pin.title + '</strong>'
        + (pin.city ? '<span style="color:#6b7280;font-size:12px;">' + pin.city + ', ' + pin.state + '</span>' : '')
        + (pin.date ? '<br><span style="color:#b8960a;font-size:12px;font-weight:700;margin-top:4px;display:block;">&#128197; Ends ' + pin.date + '</span>' : '')
        + '<br><a href="' + pin.url + '" target="_blank" style="display:inline-block;margin-top:8px;background:#FFD700;color:#1a1a1a;padding:5px 12px;border-radius:4px;font-size:12px;font-weight:700;text-decoration:none;">View Details &#x2192;</a>'
        + '</div>',
        { maxWidth: 260 }
      )
      .addTo(map);

    m.on('click', function() {
      highlightCard(pin.id);
      if (activeMarker) { activeMarker.m.setIcon(activeMarker.gi); }
      m.setIcon(goldIconActive());
      activeMarker = { m: m, gi: gi };
    });

    markers[pin.id] = m;
    bounds.push([pin.lat, pin.lng]);
  });

  if (bounds.length > 1) map.fitBounds(bounds, { padding:[50,50] });
  else if (bounds.length === 1) map.setView(bounds[0], 10);
  else {
    map.setView([37.82, -97.7], 8);
    // No pins — show a notice
    var noPin = document.createElement('div');
    noPin.style.cssText = 'position:absolute;bottom:16px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,.92);border:1px solid #ddd;border-radius:6px;padding:8px 16px;font-size:13px;color:#555;z-index:999;pointer-events:none;white-space:nowrap;';
    noPin.textContent = 'No map locations available for current auctions';
    document.getElementById('sg-map').appendChild(noPin);
  }
}

function highlightCard(cardId) {
  document.querySelectorAll('.auction-card-wrap.pin-active').forEach(function(el) { el.classList.remove('pin-active'); });
  var card = document.getElementById(cardId);
  if (card) {
    card.classList.add('pin-active');
    var col = card.closest('.sg-grid-col');
    if (col) col.scrollTo({ top: card.offsetTop - 16, behavior:'smooth' });
  }
}

function setView(mode) {
  var gc = document.getElementById('grid-cards');
  var ml = document.getElementById('map-layout');
  var pastSec = document.querySelector('.section:not(#active-section)');
  if (mode === 'map') {
    gc.style.display = 'none';
    ml.classList.add('visible');
    document.getElementById('btn-grid').classList.remove('active');
    document.getElementById('btn-map').classList.add('active');
    if (pastSec) pastSec.classList.add('sg-past-hidden');
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        initMap();
        setTimeout(function() { if (map) map.invalidateSize(true); }, 100);
        setTimeout(function() { if (map) map.invalidateSize(true); }, 500);
      });
    });
  } else {
    gc.style.display = 'grid';
    ml.classList.remove('visible');
    document.getElementById('btn-grid').classList.add('active');
    document.getElementById('btn-map').classList.remove('active');
    if (pastSec) pastSec.classList.remove('sg-past-hidden');
  }
}
</script>

</body>
</html>
`;
}

// â”€â”€ Direct Mode Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function loadPartials() {
  const headerPath = path.join(__dirname, '_partials', 'header.html');
  const footerPath = path.join(__dirname, '_partials', 'footer.html');
  const header = fs.existsSync(headerPath) ? fs.readFileSync(headerPath, 'utf8') : '';
  const footer = fs.existsSync(footerPath) ? fs.readFileSync(footerPath, 'utf8') : '';
  return { header, footer };
}

function assemblePage(html, header, footer) {
  return html.replace('<!-- HEADER -->', header).replace('<!-- FOOTER -->', footer);
}

// â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function main() {
  console.log(`generate-auctions.mjs starting... (mode: ${DIRECT_MODE ? 'direct -> dist/' : 'source -> auctions/'})`);

  const state = loadState();
  const prevAuctions = state.auctions || {};

  let auctions;
  try {
    auctions = await fetchAllAuctions();
  } catch (err) {
    console.error('Failed to fetch auctions:', err.message);
    process.exit(1);
  }

  // Filter out dummy/placeholder entries
  auctions = auctions.filter(a => a.name && !a.name.includes('WWW.SUNDGREN.COM'));

  if (!auctions.length) {
    console.warn('No auctions returned â€” aborting.');
    process.exit(0);
  }

  fs.mkdirSync(AUCTIONS_DIR, { recursive: true });

  const { header, footer } = DIRECT_MODE ? loadPartials() : { header: '', footer: '' };
  let created = 0, updated = 0;
  const newState = { lastFetch: new Date().toISOString(), auctions: { ...prevAuctions } };

  // Fetch detail (docs, taxes, earnest) for active auctions only
  const activeAuctions = auctions.filter(a => isActive(a.status));
  console.log(`  Fetching detail for ${activeAuctions.length} active auctions...`);
  for (const auction of activeAuctions) {
    const detail = await fetchAuctionDetail(auction.id);
    if (detail) {
      auction._detail = detail;
      if (detail.docs.length) console.log(`    [${auction.id}] ${detail.docs.length} doc(s): ${detail.docs.map(d => d.file_name).join(', ')}`);
      if (detail.taxes)       console.log(`    [${auction.id}] taxes: ${detail.taxes}`);
      if (detail.earnest)     console.log(`    [${auction.id}] earnest: ${detail.earnest}`);
    }
  }

  for (const auction of auctions) {
    const id  = String(auction.id);
    const prev = prevAuctions[id];
    const slug = prev?.slug || slugify(auction.name, auction.id);
    const statusChanged = prev && prev.status !== auction.status;

    newState.auctions[id] = {
      slug, status: auction.status, name: auction.name,
      generated: prev?.generated || new Date().toISOString(),
      ...(statusChanged ? { updated: new Date().toISOString() } : {})
    };

    if (DIRECT_MODE) {
      const distDir  = path.join(DIST_DIR, 'auctions', slug);
      const distPath = path.join(distDir, 'index.html');
      fs.mkdirSync(distDir, { recursive: true });
      if (true) {
        const raw  = renderAuctionPage(auction);
        const html = assemblePage(raw, header, footer);
        fs.writeFileSync(distPath, html, 'utf8');
        prev ? (console.log(`  Updated (dist, ${auction.status}): auctions/${slug}/`), updated++) : (console.log(`  Created (dist): auctions/${slug}/`), created++);
      }
    } else {
      const srcDir  = path.join(AUCTIONS_DIR, slug);
      const srcPath = path.join(srcDir, 'index.html');
      fs.mkdirSync(srcDir, { recursive: true });
      if (true) {
        fs.writeFileSync(srcPath, renderAuctionPage(auction), 'utf8');
        prev ? (console.log(`  Updated (${auction.status}): auctions/${slug}/`), updated++) : (console.log(`  Created: auctions/${slug}/`), created++);
      }
    }
  }

  // Write index
  const indexHtml = renderIndexPage(auctions, newState.auctions);
  if (DIRECT_MODE) {
    const distIndexDir = path.join(DIST_DIR, 'auctions');
    fs.mkdirSync(distIndexDir, { recursive: true });
    fs.writeFileSync(path.join(distIndexDir, 'index.html'), assemblePage(indexHtml, header, footer), 'utf8');
    console.log('  Wrote: dist/auctions/index.html');
  } else {
    fs.writeFileSync(path.join(AUCTIONS_DIR, 'index.html'), indexHtml, 'utf8');
    console.log('  Wrote: auctions/index.html');
  }

  saveState(newState);
  console.log(`\nDone. ${created} created, ${updated} updated. Total: ${auctions.length} auctions.`);
  if (!DIRECT_MODE) console.log('Now run: node build.js');
}

main().catch(e => { console.error(e); process.exit(1); });