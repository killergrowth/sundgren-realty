/**
 * generate-listing-pages.mjs
 * Generates individual listing pages from sundgren-listings.json
 * Usage: node generate-listing-pages.mjs
 */

import fs from 'fs';
import path from 'path';

const listings = JSON.parse(fs.readFileSync('./data/sundgren-listings.json', 'utf8'));

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function formatPrice(price) {
  return '$' + parseInt(price).toLocaleString();
}

function buildSlug(listing) {
  // e.g. "9657-sw-hopkins-switch-rd-augusta-ks"
  const parts = listing.address.split(',');
  const street = parts[0] ? slugify(parts[0]) : 'listing';
  const city = parts[1] ? slugify(parts[1].trim()) : '';
  const state = parts[2] ? slugify(parts[2].trim().split(' ')[0]) : 'ks';
  return `${street}-${city}-${state}`.substring(0, 80);
}

function buildTitle(listing) {
  const addr = listing.address;
  const parts = [];
  if (listing.beds) parts.push(`${listing.beds}BD`);
  if (listing.baths) parts.push(`${listing.baths}BA`);
  if (listing.acres && parseFloat(listing.acres) > 0.5) parts.push(`${listing.acres} Acres`);
  const specs = parts.length ? ` &#8211; ${parts.join('/')} Home` : '';
  return `${addr}${specs} | Sundgren Realty`;
}

function buildDescription(listing) {
  const beds = listing.beds ? `${listing.beds} bed, ` : '';
  const baths = listing.baths ? `${listing.baths} bath` : '';
  const sqft = listing.sqft ? `, ${parseInt(listing.sqft).toLocaleString()} sq ft` : '';
  const acres = listing.acres && parseFloat(listing.acres) > 0.5 ? ` on ${listing.acres} acres` : '';
  const price = formatPrice(listing.price);
  return `${beds}${baths}${sqft} home${acres} at ${listing.address}. Listed at ${price} by ${listing.agent} with Sundgren Realty.`;
}

function buildPhotoHtml(listing) {
  const id = listing.listingId;
  const baseUrl = `https://s3.amazonaws.com/mlsphotos.idxbroker.com/photos`;
  // Use the IDX photo gallery URL for the link
  const galleryUrl = `https://realestate.sundgren.com/idx/details/listing/${id}/`;
  
  // We can't get individual photo hashes without visiting each detail page,
  // so link to the IDX detail page for photos
  return `
    <div style="text-align:center;padding:40px 20px;background:#f5f5f5;">
      <p style="font-size:14px;color:var(--text-light);margin:0 0 12px;">View all photos on the listing page</p>
      <a href="${galleryUrl}" target="_blank" rel="noopener" class="btn-yellow" style="display:inline-block;">View Photos &amp; Details &rarr;</a>
    </div>`;
}

function buildStatusPill(status) {
  const s = (status || 'Active').toLowerCase();
  if (s === 'pending') return '<span class="pill pill-pending">PENDING</span>';
  if (s === 'sold') return '<span class="pill pill-sold">SOLD</span>';
  return '<span class="pill pill-active">ACTIVE</span>';
}

function buildAddressparts(address) {
  const parts = address.split(',').map(p => p.trim());
  return {
    street: parts[0] || '',
    city: parts[1] || '',
    stateZip: parts[2] || 'KS',
  };
}

function buildPageHtml(listing) {
  const slug = buildSlug(listing);
  const canonicalUrl = `https://sundgrenrealty.com/listings/${slug}/`;
  const addr = buildAddressparts(listing.address);
  const price = formatPrice(listing.price);
  const title = buildTitle(listing);
  const desc = buildDescription(listing);
  const statusPill = buildStatusPill(listing.status);
  const idxDetailUrl = `https://realestate.sundgren.com/idx/details/listing/${listing.listingId}/`;
  const idxPhotoUrl = `https://realestate.sundgren.com/idx/photogallery/c147/${listing.listingId}`;

  const bedsHtml = listing.beds ? `
              <div style="background:#fff;border-radius:8px;padding:12px;text-align:center;">
                <div style="font-size:18px;font-weight:800;color:var(--dark);">${listing.beds}</div>
                <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:.05em;">Beds</div>
              </div>` : '';

  const bathsHtml = listing.baths ? `
              <div style="background:#fff;border-radius:8px;padding:12px;text-align:center;">
                <div style="font-size:18px;font-weight:800;color:var(--dark);">${listing.baths}</div>
                <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:.05em;">Baths</div>
              </div>` : '';

  const sqftHtml = listing.sqft ? `
              <div style="background:#fff;border-radius:8px;padding:12px;text-align:center;">
                <div style="font-size:18px;font-weight:800;color:var(--dark);">${parseInt(listing.sqft).toLocaleString()}</div>
                <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:.05em;">Sq Ft</div>
              </div>` : '';

  const acresHtml = listing.acres && parseFloat(listing.acres) > 0 ? `
              <div style="background:#fff;border-radius:8px;padding:12px;text-align:center;">
                <div style="font-size:18px;font-weight:800;color:var(--dark);">${listing.acres}</div>
                <div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:.05em;">Acres</div>
              </div>` : '';

  const detailItems = [
    `<li><strong>Address:</strong> ${listing.address}</li>`,
    listing.beds ? `<li><strong>Bedrooms:</strong> ${listing.beds}</li>` : '',
    listing.baths ? `<li><strong>Bathrooms:</strong> ${listing.baths}</li>` : '',
    listing.sqft ? `<li><strong>Square Footage:</strong> ${parseInt(listing.sqft).toLocaleString()} sq ft</li>` : '',
    listing.acres && parseFloat(listing.acres) > 0 ? `<li><strong>Lot Size:</strong> ${listing.acres} acres</li>` : '',
    `<li><strong>Property Type:</strong> Residential</li>`,
    `<li><strong>Status:</strong> ${listing.status || 'Active'}</li>`,
    `<li><strong>Listing ID:</strong> ${listing.listingId}</li>`,
  ].filter(Boolean).join('\n              ');

  const propDesc = listing.description
    ? listing.description.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    : `${listing.address} is a well-maintained property located in ${addr.city}, Kansas. Contact Sundgren Realty for full details and to schedule a showing.`;

  const schemaObj = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "name": listing.address,
    "url": canonicalUrl,
    "description": desc,
    "offers": { "@type": "Offer", "price": listing.price, "priceCurrency": "USD" },
    "address": {
      "@type": "PostalAddress",
      "streetAddress": addr.street,
      "addressLocality": addr.city,
      "addressRegion": "KS",
      "addressCountry": "US"
    },
  };
  if (listing.beds) schemaObj.numberOfRooms = parseInt(listing.beds);
  if (listing.sqft) schemaObj.floorSize = { "@type": "QuantitativeValue", "value": parseInt(listing.sqft), "unitCode": "SQFT" };

  const shortAddr = `${addr.street}, ${addr.city}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:title" content="${listing.address} | Sundgren Realty">
  <meta property="og:description" content="${desc}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="https://sundgren-realty.pages.dev/images/og-preview.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://sundgren-realty.pages.dev/images/og-preview.png">
  <script type="application/ld+json">${JSON.stringify(schemaObj)}</script>
  <link rel="icon" href="/images/favicon-black.png" type="image/png" media="(prefers-color-scheme: light)">
  <link rel="icon" href="/images/favicon.png" type="image/png" media="(prefers-color-scheme: dark)">
  <link rel="apple-touch-icon" href="/images/favicon.png">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="/css/sundgren.css">
</head>
<body>

<!-- HEADER -->

<main>

  <section class="auction-hero" style="background-image:url('/images/hero-house.jpg')">
    <div class="hero-inner">
      <div class="container">
        <div style="max-width:700px;margin:0 auto;text-align:center;">
          ${statusPill}
          <h1 style="color:#fff;font-size:clamp(22px,4vw,38px);font-weight:900;margin:0 0 10px;line-height:1.2;">${listing.address}</h1>
          <nav aria-label="Breadcrumb" style="margin-top:16px;">
            <ol class="breadcrumb">
              <li><a href="/">Home</a></li>
              <li><a href="/listings/">Listings</a></li>
              <li class="active">${shortAddr}</li>
            </ol>
          </nav>
        </div>
      </div>
    </div>
  </section>

  <section style="background:#f5f5f5;padding:30px 0;">
    <div class="container" style="text-align:center;">
      <p style="margin:0 0 12px;font-size:14px;color:var(--text-light);">See all photos and full MLS details for this listing</p>
      <a href="${idxDetailUrl}" target="_blank" rel="noopener" class="btn-yellow" style="display:inline-block;margin-right:10px;">View Full Listing Details &rarr;</a>
      <a href="${idxPhotoUrl}" target="_blank" rel="noopener" class="btn-outline" style="display:inline-block;">Photo Gallery</a>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="auction-detail-grid">
        <div>
          <h2 style="font-size:20px;font-weight:800;color:var(--dark);margin:0 0 16px;padding-bottom:10px;border-bottom:2px solid #FFD700;">About This Property</h2>

          <style>
            .desc-section { margin-bottom:18px; padding:16px 20px; background:var(--bg-light); border-radius:8px; border-left:4px solid var(--yellow); }
            .desc-section:last-child { margin-bottom:0; }
            .desc-section-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--dark); margin:0 0 10px; display:flex; align-items:center; gap:8px; }
            .desc-section-title i { color:var(--yellow-dark); font-size:13px; }
            .desc-section p { font-size:14px; line-height:1.75; color:var(--text); margin:0; }
            .desc-section ul { margin:0; padding-left:0; list-style:none; display:flex; flex-direction:column; gap:6px; }
            .desc-section ul li { display:flex; align-items:flex-start; gap:8px; font-size:14px; line-height:1.6; color:var(--text); }
            .desc-section ul li::before { content:''; display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--yellow); flex-shrink:0; margin-top:6px; }
          </style>

          <p style="font-size:13px;color:var(--text-light);margin:0 0 16px;font-style:italic;"><i class="fas fa-user" style="margin-right:6px;color:var(--yellow-dark);"></i>Listing courtesy of ${listing.agent} with Sundgren Realty</p>

          <div class="desc-section">
            <h3 class="desc-section-title"><i class="fas fa-home"></i> Property Description</h3>
            <p>${propDesc}</p>
          </div>

          <div class="desc-section">
            <h3 class="desc-section-title"><i class="fas fa-ruler-combined"></i> Property Details</h3>
            <ul>
              ${detailItems}
            </ul>
          </div>

          <div class="desc-section">
            <h3 class="desc-section-title"><i class="fas fa-map-marker-alt"></i> Location</h3>
            <p>Located in ${addr.city}, Kansas &#8212; serving south central Kansas including El Dorado, Wichita, and surrounding communities. Contact Sundgren Realty for more information or to schedule a showing.</p>
          </div>
        </div>

        <div>
          <div style="background:var(--bg-light);border-radius:12px;padding:24px;margin-bottom:24px;">
            <div style="font-size:28px;font-weight:900;color:var(--dark);margin-bottom:4px;">${price}</div>
            <div style="font-size:14px;color:var(--text-light);margin-bottom:20px;">Listed Price</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
              ${bedsHtml}${bathsHtml}${sqftHtml}${acresHtml}
            </div>
            <a href="/contact-us/" class="btn-yellow" style="display:block;text-align:center;margin-bottom:10px;">Contact an Agent</a>
            <a href="/listings/" class="btn-outline" style="display:block;text-align:center;">Browse More Listings</a>
          </div>

          <div style="background:var(--bg-light);border-radius:12px;padding:24px;">
            <h3 style="font-size:15px;font-weight:800;color:var(--dark);margin:0 0 12px;">Listing Agent</h3>
            <p style="font-size:14px;color:var(--text);margin:0 0 4px;"><strong>${listing.agent}</strong></p>
            <p style="font-size:13px;color:var(--text-light);margin:0 0 12px;">Sundgren Realty &amp; Auction</p>
            <a href="/agents/" style="font-size:13px;color:var(--red);font-weight:700;text-decoration:none;">View Our Agents &#8594;</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="cta-dark">
    <div class="container">
      <h2>Interested in This Property?</h2>
      <p>Our agents know South Central Kansas real estate inside and out. Reach out for a showing or more information.</p>
      <a href="/contact-us/" class="btn-yellow">Contact Our Team</a>
      <a href="/listings/" class="btn-outline-white">Browse All Listings</a>
    </div>
  </section>

</main>

<!-- FOOTER -->

</body>
</html>`;
}

// Already-built pages to skip
const alreadyBuilt = new Set([
  '672300', // 5747 SW 20th
  '676431', // 10608 SW 90th
  '672322', // 9657 SW Hopkins — land example
]);

let built = 0;
let skipped = 0;

for (const listing of listings) {
  if (alreadyBuilt.has(listing.listingId)) {
    console.log(`SKIP (already built): ${listing.address}`);
    skipped++;
    continue;
  }

  const slug = buildSlug(listing);
  const dir = `./listings/${slug}`;

  if (fs.existsSync(dir)) {
    console.log(`SKIP (dir exists): ${slug}`);
    skipped++;
    continue;
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/index.html`, buildPageHtml(listing), 'utf8');
  console.log(`BUILT: ${listing.address} → ${slug}`);
  built++;
}

console.log(`\nDone. Built: ${built}, Skipped: ${skipped}`);
