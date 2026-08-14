/**
 * rebuild-listing-pages.mjs
 * Rebuilds all auto-generated listing pages with the correct design:
 * - Hero uses MLS photo as background
 * - Proper info-card sidebar (matches commercial page pattern)
 * - NO fake photo grid / "View All Photos" button section
 * - Photo Gallery link goes in the sidebar as a secondary CTA
 *
 * Run: node rebuild-listing-pages.mjs
 */

import fs from 'fs';
import path from 'path';

const LISTINGS_DIR = './listings';

function formatPrice(price) {
  if (!price) return 'Contact for Price';
  return '$' + parseInt(price).toLocaleString();
}

function buildPageHtml(listing) {
  const slug = path.basename(listing._dir);
  const canonicalUrl = `https://sundgrenrealty.com/listings/${slug}/`;
  const price = formatPrice(listing.price);
  const statusClass = (listing.status || 'Active').toLowerCase();
  const statusLabel = (listing.status || 'Active').toUpperCase();
  const shortAddr = listing.street ? `${listing.street}, ${listing.city}` : listing.address;
  const heroImg = listing.photoUrl || '/images/og-preview.png';

  // Build meta-list items for sidebar info-card
  const metaItems = [
    `<li><i class="fas fa-tag"></i><div><span class="mlabel">Price</span>${price}</div></li>`,
    listing.beds ? `<li><i class="fas fa-bed"></i><div><span class="mlabel">Bedrooms</span>${listing.beds}</div></li>` : '',
    listing.baths ? `<li><i class="fas fa-bath"></i><div><span class="mlabel">Bathrooms</span>${listing.baths}</div></li>` : '',
    listing.sqft ? `<li><i class="fas fa-ruler-combined"></i><div><span class="mlabel">Sq Ft</span>${parseInt(listing.sqft).toLocaleString()}</div></li>` : '',
    listing.acres && parseFloat(listing.acres) > 0 ? `<li><i class="fas fa-expand-arrows-alt"></i><div><span class="mlabel">Lot Size</span>${listing.acres} acres</div></li>` : '',
    `<li><i class="fas fa-info-circle"></i><div><span class="mlabel">Status</span>${listing.status || 'Active'}</div></li>`,
    listing.listingId ? `<li><i class="fas fa-hashtag"></i><div><span class="mlabel">MLS#</span>${listing.listingId}</div></li>` : '',
    `<li><i class="fas fa-phone"></i><div><span class="mlabel">Questions?</span><a href="tel:3163217112" style="color:var(--yellow-dark);">316-321-7112</a></div></li>`,
  ].filter(Boolean).join('\n              ');

  // Property details for desc-section
  const detailItems = [
    `<li><strong>Address:</strong> ${listing.address}</li>`,
    listing.beds ? `<li><strong>Bedrooms:</strong> ${listing.beds}</li>` : '',
    listing.baths ? `<li><strong>Bathrooms:</strong> ${listing.baths}</li>` : '',
    listing.sqft ? `<li><strong>Square Footage:</strong> ${parseInt(listing.sqft).toLocaleString()} sq ft</li>` : '',
    listing.acres && parseFloat(listing.acres) > 0 ? `<li><strong>Lot Size:</strong> ${listing.acres} acres</li>` : '',
    `<li><strong>Status:</strong> ${listing.status || 'Active'}</li>`,
    listing.listingId ? `<li><strong>Listing ID:</strong> ${listing.listingId}</li>` : '',
  ].filter(Boolean).join('\n              ');

  const propDesc = listing.description
    ? listing.description.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    : `${listing.address} is located in ${listing.city}, Kansas. Contact Sundgren Realty for full details and to schedule a showing.`;

  const metaDesc = [
    listing.beds ? `${listing.beds} bed` : '',
    listing.baths ? `${listing.baths} bath` : '',
    listing.sqft ? `${parseInt(listing.sqft).toLocaleString()} sq ft` : '',
    listing.acres && parseFloat(listing.acres) > 0.5 ? `on ${listing.acres} acres` : '',
    `at ${listing.address}.`,
    `${price}.`,
    `Listed by ${listing.agent || 'Sundgren'} with Sundgren Realty.`,
  ].filter(Boolean).join(' ').trim();

  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "name": listing.address,
    "url": canonicalUrl,
    "description": metaDesc,
    "offers": { "@type": "Offer", "price": listing.price || "0", "priceCurrency": "USD" },
    "address": {
      "@type": "PostalAddress",
      "streetAddress": listing.street,
      "addressLocality": listing.city,
      "addressRegion": "KS",
      "postalCode": listing.zip,
      "addressCountry": "US"
    },
    ...(listing.beds ? { "numberOfRooms": parseInt(listing.beds) } : {}),
    ...(listing.sqft ? { "floorSize": { "@type": "QuantitativeValue", "value": parseInt(listing.sqft), "unitCode": "SQFT" } } : {}),
  });

  // Back link — listings use /listings/ index
  const backLink = `<a href="/listings/" class="btn-all">&larr; All Listings</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${listing.address} | Sundgren Realty &amp; Auction</title>
  <meta name="description" content="${metaDesc}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:title" content="${listing.address} | Sundgren Realty &amp; Auction">
  <meta property="og:description" content="${metaDesc}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${heroImg}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${heroImg}">
  <script type="application/ld+json">${schema}</script>
  <link rel="icon" href="/images/favicon-black.png" type="image/png" media="(prefers-color-scheme: light)">
  <link rel="icon" href="/images/favicon.png" type="image/png" media="(prefers-color-scheme: dark)">
  <link rel="apple-touch-icon" href="/images/favicon.png">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="/css/sundgren.css">
</head>
<body>

<!-- HEADER -->

<main>

  <section class="auction-hero" style="background-image:url('${heroImg}')">
    <div class="hero-inner">
      <div class="container">
        <div style="max-width:700px;margin:0 auto;text-align:center;">
          <span class="pill pill-${statusClass}">${statusLabel}</span>
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

          <p style="font-size:13px;color:var(--text-light);margin:0 0 16px;font-style:italic;"><i class="fas fa-user" style="margin-right:6px;color:var(--yellow-dark);"></i>Listed by ${listing.agent || 'Sundgren Agent'} with Sundgren Realty${listing.listingId ? ` | MLS# ${listing.listingId}` : ''}</p>

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
            <p>Located in ${listing.city}, Kansas — serving south central Kansas and surrounding communities. Contact Sundgren Realty for a showing or more information.</p>
          </div>

          <div class="desc-section">
            <h3 class="desc-section-title"><i class="fas fa-info-circle"></i> Listing Information</h3>
            <p style="font-size:13px;color:var(--text-light);line-height:1.7;">Listing ID ${listing.listingId || 'N/A'}. Courtesy of ${listing.agent || 'Sundgren Realty'} with Sundgren Realty. Data provided by SCKMLS. All information deemed reliable but not guaranteed and should be independently verified. Subject to prior sale, change, or withdrawal.</p>
          </div>
        </div>

        <div>
          <div class="info-card">
            <h4>Listing Details</h4>
            <ul class="meta-list">
              ${metaItems}
            </ul>
            <a href="${listing.detailUrl}" target="_blank" rel="noopener" class="btn-bid">View Full MLS Listing &rarr;</a>
            <a href="${listing.photoGalleryUrl}" target="_blank" rel="noopener" class="btn-all" style="margin-top:8px;display:block;text-align:center;padding:10px;background:var(--bg-light);border-radius:6px;text-decoration:none;color:var(--dark);font-size:13px;font-weight:600;"><i class="fas fa-images" style="margin-right:6px;color:var(--yellow-dark);"></i>View Photo Gallery</a>
            <a href="mailto:realty@sundgren.com?subject=Question about ${encodeURIComponent(listing.address)}${listing.listingId ? ` (MLS ${listing.listingId})` : ''}" class="btn-all" style="margin-top:8px;display:block;text-align:center;padding:10px;background:var(--bg-light);border-radius:6px;text-decoration:none;color:var(--dark);font-size:13px;font-weight:600;"><i class="fas fa-envelope" style="margin-right:6px;color:var(--yellow-dark);"></i>Email an Agent</a>
            ${backLink}
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
      <a href="/listings/" class="btn-outline-white">&larr; All Listings</a>
    </div>
  </section>

</main>

<!-- FOOTER -->

</body>
</html>`;
}

// Load all listings from the full JSON
const jsonPath = './data/sundgren-listings-full.json';
if (!fs.existsSync(jsonPath)) {
  console.error('Missing data/sundgren-listings-full.json — run build-all-listing-pages.mjs first');
  process.exit(1);
}

const allListings = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
console.log(`Loaded ${allListings.length} listings from JSON`);

// Also collect listings from dirs that might not be in the JSON
// (hand-built or commercial ones we added separately)
// For those, we'll skip — they already have correct design

// Slugify to match directory names
function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 80);
}

function buildSlug(listing) {
  const parts = listing.address.split(',');
  const street = parts[0] ? slugify(parts[0]) : 'listing';
  const city = parts[1] ? slugify(parts[1].trim()) : '';
  return `${street}-${city}-ks`.substring(0, 80);
}

let rebuilt = 0;
let skipped = 0;

for (const listing of allListings) {
  if (!listing.address || !listing.listingId) {
    skipped++;
    continue;
  }

  const slug = buildSlug(listing);
  const dir = `${LISTINGS_DIR}/${slug}`;

  if (!fs.existsSync(dir)) {
    console.log(`SKIP (no dir): ${slug}`);
    skipped++;
    continue;
  }

  listing._dir = dir;
  const html = buildPageHtml(listing);
  fs.writeFileSync(`${dir}/index.html`, html, 'utf8');
  rebuilt++;
}

console.log(`\nRebuilt: ${rebuilt} | Skipped: ${skipped}`);
