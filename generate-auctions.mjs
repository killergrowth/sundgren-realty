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
 *   node generate-auctions.mjs            (source mode — writes to auctions/, run build.js after)
 *   node generate-auctions.mjs --direct   (direct mode — writes assembled pages to dist/)
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────
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

// ── Helpers ──────────────────────────────────────────────────────────────
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

// ── API ───────────────────────────────────────────────────────────────────
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

// ── State ─────────────────────────────────────────────────────────────────
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

// ── Photo Grid + Lightbox ────────────────────────────────────────────────
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

// ── Info Card ─────────────────────────────────────────────────────────────
function renderInfoCard(auction) {
  const active  = isActive(auction.status);
  const startDt = formatDateTime(auction.starts_at);
  const endDt   = formatDateTime(auction.scheduled_end_time);
  const bwUrl   = `${BW_BASE_URL}/ui/auctions/${auction.id}`;
  const phone   = auction.coord_phone || '316-321-7112';

  const cta = active
    ? `        <a href="#sg-embed" class="btn-bid" onclick="document.getElementById('sg-embed').scrollIntoView({behavior:'smooth'});return false;">Register to Bid &rarr;</a>
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

// ── Individual Auction Page ───────────────────────────────────────────────
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

  let descHtml = '';
  if (auction.formatted_simple_description) {
    descHtml = auction.formatted_simple_description;
  } else if (auction.simple_description) {
    descHtml = `<p>${esc(auction.simple_description)}</p>`;
  } else if (auction.description) {
    descHtml = `<p>${esc(auction.description)}</p>`;
  } else {
    descHtml = '<p>Contact Sundgren Realty for more information about this property.</p>';
  }

  const photoGrid = renderPhotoGrid(auction.featured_images);
  const infoCard  = renderInfoCard(auction);
  const bwUrl     = `${BW_BASE_URL}/ui/auctions/${auction.id}`;

  const bwEmbed = active ? `
    <div class="embed-wrap" id="sg-embed">
        <div class="container">
            <div class="section-title mb-40">
                <span class="eyebrow">Online Bidding</span>
                <h2>Place Your Bid</h2>
                <hr class="divider">
                <p>Register below to participate in this auction online. Create a free account to get started.</p>
            </div>
            <iframe
                src="${esc(bwUrl)}"
                title="${esc(auction.name)} &#8212; Online Bidding"
                allowfullscreen
                loading="lazy"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation">
            </iframe>
        </div>
    </div>` : '';

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
  <meta name="robots" content="noindex, nofollow">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:title" content="${esc(metaTitle)}">
  <meta property="og:description" content="${esc(metaDesc)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(canonical)}">
  ${ogImg ? `<meta property="og:image" content="${esc(ogImg)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${esc(ogImg)}">` : `<meta name="twitter:card" content="summary">`}
  <script type="application/ld+json">${schema}</script>
  <!-- SCHEMA:BreadcrumbList -->
  <link rel="icon" href="/images/favicon.ico" type="image/x-icon">
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

// ── Auction Index Page ────────────────────────────────────────────────────
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
  <meta name="robots" content="noindex, nofollow">
  <link rel="canonical" href="${SITE_DOMAIN}/auctions/">
  <meta property="og:title" content="Auctions | Sundgren Realty &amp; Auction | El Dorado, KS">
  <meta property="og:description" content="Active and upcoming real estate auctions in South Central Kansas from Sundgren Realty.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${SITE_DOMAIN}/auctions/">
  <meta name="twitter:card" content="summary">
  <!-- SCHEMA:BreadcrumbList -->
  <link rel="icon" href="/images/favicon.ico" type="image/x-icon">
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

// ── Direct Mode Helpers ───────────────────────────────────────────────────
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

// ── Main ──────────────────────────────────────────────────────────────────
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
    console.warn('No auctions returned — aborting.');
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