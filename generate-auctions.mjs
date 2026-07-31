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
function renderInfoCard(auction) {
  const active  = isActive(auction.status);
  const startDt = formatDateTime(auction.starts_at);
  const endDt   = formatDateTime(auction.scheduled_end_time);
  const bwUrl   = `${BW_BASE_URL}/ui/auctions/${auction.id}`;
  const phone   = auction.coord_phone || '316-321-7112';

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
            <li><i class="fas fa-phone"></i><div><span class="mlabel">Questions?</span><a href="tel:${phone.replace(/\D/g,'')}" style="color:var(--yellow-dark);">${esc(phone)}</a></div></li>
        </ul>
${cta}
    </div>`;
}

// â”€â”€ Description Parser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function parseDescription(raw) {
  // 1. Strip HTML tags from formatted descriptions
  let text = String(raw || '').replace(/<[^>]+>/g, ' ');
  // 2. Fix encoding artifacts: Ã‚ + NBSP (\u00c2\u00a0) and similar
  text = text
    .replace(/\u00c2\u00a0/g, ' ')
    .replace(/\u00c2/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/A,A[\u00b0\u00a0Â°\s]/g, ' ')
    .replace(/Ã‚ /g, ' ')
    .replace(/Ã‚/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 3. Split into named sections on known keywords
  const sectionKeys = ['PICKUP', 'TERMS', 'LOCATION', 'NOTE', 'NOTES', 'PREVIEW', 'REMOVAL', 'PAYMENT', 'BIDDING', 'SHIPPING', 'INSPECTION'];
  const sectionRegex = new RegExp(`(${sectionKeys.join('|')}):`, 'g');

  // 4. Detect lot list pattern: "Lot # Name\n1 Item desc\n2 Item desc"
  //    or inline: "Lot # Name 1 Item 2 Item"
  const lotRegex = /Lot\s*#?\s*Name\s*(\d+.+)/i;
  const inlineLotRegex = /Lot\s*#?\s*Name\s+((?:\d+\s+.+?\s*)+)$/i;

  let html = '';

  // Split on section keywords
  const parts = text.split(sectionRegex);
  // parts: ['pre-text', 'PICKUP', 'pickup text', 'TERMS', 'terms text', ...]

  let preLot = '';
  let lotBlock = '';

  // Walk parts â€” odd indexes are section names, even are content
  let i = 0;
  // If parts[0] is non-empty content before first keyword
  let preContent = parts[0].trim();

  const sections = [];
  if (preContent) sections.push({ title: null, body: preContent });
  for (let j = 1; j < parts.length; j += 2) {
    const title = parts[j];
    const body = (parts[j + 1] || '').trim();
    sections.push({ title, body });
  }

  // If no sections found, treat entire text as one block
  if (sections.length === 0) sections.push({ title: null, body: text });

  // Render each section
  for (const sec of sections) {
    // Detect lot table inside body
    const lotMatch = sec.body.match(/Lot\s*#?\s*Name\s+(.+)/i);
    let bodyText = sec.body;
    let lotHtml = '';

    if (lotMatch) {
      bodyText = sec.body.substring(0, sec.body.search(/Lot\s*#?\s*Name/i)).trim();
      const lotRaw = lotMatch[1];
      // Parse "1 Item desc 2 Item desc 3 ..." pattern
      const lotItems = [];
      const lotItemRegex = /(\d+)\s+(.+?)(?=\s+\d+\s+|$)/g;
      let m;
      while ((m = lotItemRegex.exec(lotRaw)) !== null) {
        lotItems.push({ num: m[1], name: m[2].trim() });
      }
      if (lotItems.length > 0) {
        lotHtml = `
          <div class="lot-table-wrap" style="margin-top:20px;">
            <h3 style="font-size:16px;font-weight:700;color:var(--dark);margin:0 0 12px;display:flex;align-items:center;gap:8px;">
              <i class="fas fa-list" style="color:var(--yellow-dark);"></i> Lot List
            </h3>
            <div style="overflow-x:auto;">
            <table class="lot-table">
              <thead><tr><th style="width:50px;">#</th><th>Item</th></tr></thead>
              <tbody>
                ${lotItems.map(l => `<tr><td style="font-weight:700;color:var(--dark);">${esc(l.num)}</td><td>${esc(l.name)}</td></tr>`).join('\n                ')}
              </tbody>
            </table>
            </div>
          </div>`;
      }
    }

    if (sec.title) {
      // Icon map
      const icons = {
        PICKUP: 'fa-box-open', REMOVAL: 'fa-box-open',
        TERMS: 'fa-file-contract',
        LOCATION: 'fa-map-marker-alt',
        PAYMENT: 'fa-credit-card',
        PREVIEW: 'fa-eye', INSPECTION: 'fa-eye',
        BIDDING: 'fa-gavel',
        SHIPPING: 'fa-truck',
        NOTE: 'fa-info-circle', NOTES: 'fa-info-circle',
      };
      const icon = icons[sec.title] || 'fa-info-circle';
      html += `
        <div class="desc-section">
          <h3 class="desc-section-title">
            <i class="fas ${icon}"></i> ${sec.title.charAt(0) + sec.title.slice(1).toLowerCase()}
          </h3>
          ${bodyText ? `<p>${esc(bodyText)}</p>` : ''}
          ${lotHtml}
        </div>`;
    } else {
      // No section title â€” render as plain intro paragraph
      if (bodyText) html += `<p style="margin-bottom:16px;">${esc(bodyText)}</p>`;
      if (lotHtml) html += lotHtml;
    }
  }

  // Add lot table CSS inline (injected once per page)
  const css = `<style>
    .desc-section { margin-bottom:24px; padding:18px 20px; background:var(--bg-light); border-radius:8px; border-left:4px solid var(--yellow); }
    .desc-section:last-child { margin-bottom:0; }
    .desc-section-title { font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--dark); margin:0 0 10px; display:flex; align-items:center; gap:8px; }
    .desc-section-title i { color:var(--yellow-dark); font-size:14px; }
    .desc-section p { font-size:14px; line-height:1.75; color:var(--text); margin:0; }
    .lot-table { width:100%; border-collapse:collapse; font-size:14px; }
    .lot-table th { background:var(--dark); color:#fff; padding:8px 12px; text-align:left; font-size:12px; text-transform:uppercase; letter-spacing:.05em; }
    .lot-table td { padding:8px 12px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:top; }
    .lot-table tr:last-child td { border-bottom:none; }
    .lot-table tr:nth-child(even) td { background:#f9f9f9; }
  </style>`;

  return css + html;
}

// â”€â”€ Individual Auction Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  const infoCard  = renderInfoCard(auction);
  const bwUrl     = `${BW_BASE_URL}/ui/auctions/${auction.id}`;

  const bwEmbed = '';

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
                    <div style="color:var(--text);line-height:1.8;">
                        ${descHtml}
                    </div>
                    ${photoGrid}
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
  const startDt  = formatDateTime(auction.starts_at);
  const active   = isActive(auction.status);
  const status   = (auction.status || '').toLowerCase();
  const badgeCls = active ? (status === 'accepting_bids' || status === 'active' ? 'active' : 'upcoming') : 'sold';
  const badgeLbl = statusLabel(auction.status);

  const imgStyle = imgUrl
    ? `style="background-image:url('${esc(imgUrl)}')"` : '';
  const soldOverlay = !active ? `<div class="sold-overlay"><span>SOLD</span></div>` : '';

  return `        <div class="col-4">
            <a href="/auctions/${esc(slug)}/" class="auction-card-wrap">
                <div class="auction-card">
                    <div class="auction-card-img" ${imgStyle}>
                        <span class="auction-card-badge ${badgeCls}">${badgeLbl}</span>
                        ${soldOverlay}
                    </div>
                    <div class="auction-card-body">
                        <p class="auction-card-title">${esc(auction.name || 'Auction')}</p>
                        ${startDt ? `<p class="auction-card-meta"><i class="fas fa-calendar-alt"></i>${esc(startDt)}</p>` : ''}
                        ${auction.online_only ? `<p class="auction-card-meta"><i class="fas fa-laptop"></i>Online Only</p>` : ''}
                        <span class="auction-card-more">View Details &rarr;</span>
                    </div>
                </div>
            </a>
        </div>`;
}

function renderIndexPage(auctions, stateAuctions) {
  const active = auctions.filter(a => isActive(a.status));
  const past   = auctions.filter(a => !isActive(a.status));

  const activeCards = active.length
    ? active.map(a => renderCard(a, stateAuctions[String(a.id)]?.slug || slugify(a.name, a.id))).join('\n')
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

    <section class="section">
        <div class="container">
            <div class="section-title">
                <span class="eyebrow">Active &amp; Upcoming</span>
                <h2>Current Auctions</h2>
                <hr class="divider">
                <p>Browse live auction opportunities from Sundgren Realty &amp; Auction. Click any listing for full details, photos, and online bidding.</p>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px;">
${activeCards}
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
      if (!fs.existsSync(distPath) || statusChanged) {
        const raw  = renderAuctionPage(auction);
        const html = assemblePage(raw, header, footer);
        fs.writeFileSync(distPath, html, 'utf8');
        prev ? (console.log(`  Updated (dist, ${auction.status}): auctions/${slug}/`), updated++) : (console.log(`  Created (dist): auctions/${slug}/`), created++);
      }
    } else {
      const srcDir  = path.join(AUCTIONS_DIR, slug);
      const srcPath = path.join(srcDir, 'index.html');
      fs.mkdirSync(srcDir, { recursive: true });
      if (!fs.existsSync(srcPath) || statusChanged) {
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