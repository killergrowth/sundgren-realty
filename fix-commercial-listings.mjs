/**
 * fix-commercial-listings.mjs
 * Rebuilds the 3 commercial listings that live under /listings/
 * using the correct info-card sidebar pattern.
 */

import fs from 'fs';

const listings = [
  {
    listingId: '669041',
    address: '219 S Haverhill Rd, El Dorado, KS 67042',
    street: '219 S Haverhill Rd',
    city: 'El Dorado',
    zip: '67042',
    price: '99000',
    status: 'Active',
    sqft: '3220',
    acres: '0.73',
    agent: 'Audrey',
    description: 'High visibility frontage at 219 S Haverhill in El Dorado — prime location across the street from BG Products Stadium. The 3/4-acre lot offers what could be combined into one or left as two separate parcels. An exceptional opportunity for retail, office, or commercial development in one of El Dorado\'s highest-traffic corridors.',
    photoUrl: 'https://s3.amazonaws.com/mlsphotos.idxbroker.com/photos/f7b7/7b7f8a0db7bcd1d8259ffb5f5bb4891b/c147',
    detailUrl: 'https://realestate.sundgren.com/idx/details/listing/c147/669041/219-S-Haverhill-Rd-El-Dorado-Kansas',
    photoGalleryUrl: 'https://realestate.sundgren.com/idx/photogallery/c147/669041',
    _slug: '219-s-haverhill-rd-el-dorado-ks',
    type: 'commercial',
  },
  {
    listingId: '660706',
    address: '117 W 2nd Ave, El Dorado, KS 67042',
    street: '117 W 2nd Ave',
    city: 'El Dorado',
    zip: '67042',
    price: '90000',
    status: 'Active',
    sqft: '560',
    acres: '0.11',
    agent: 'Ashleigh',
    description: 'Turn-key restaurant opportunity in the heart of El Dorado, KS! This established business is fully equipped and ready for you to step in and start serving on day one. All equipment included.',
    photoUrl: 'https://s3.amazonaws.com/mlsphotos.idxbroker.com/photos/4b95/59b4f649e6eb880ed5a9a9a5c1c37f06/c147',
    detailUrl: 'https://realestate.sundgren.com/idx/details/listing/c147/660706/117-W-2nd-Ave-El-Dorado-Kansas',
    photoGalleryUrl: 'https://realestate.sundgren.com/idx/photogallery/c147/660706',
    _slug: '117-w-2nd-ave-el-dorado-ks',
    type: 'commercial',
  },
  {
    listingId: '635999',
    address: '4774 W Maple, Wichita, KS 67209',
    street: '4774 W Maple',
    city: 'Wichita',
    zip: '67209',
    price: '68000',
    status: 'Active',
    sqft: '15056',
    acres: '0.35',
    agent: 'Steven',
    description: 'Great location for a new small business. Lots of traffic on Maple Street and with electric on site and water available this has lots of potential!',
    photoUrl: 'https://s3.amazonaws.com/mlsphotos.idxbroker.com/photos/e451/154e57d57fcb6fb051c34e5d3fd5a767/c147',
    detailUrl: 'https://realestate.sundgren.com/idx/details/listing/c147/635999/4774-W-Maple-Wichita-Kansas',
    photoGalleryUrl: 'https://realestate.sundgren.com/idx/photogallery/c147/635999',
    _slug: '4774-w-maple-wichita-ks',
    type: 'commercial',
  },
];

function fmtPrice(p) {
  if (!p) return 'Contact for Price';
  return '$' + parseInt(p).toLocaleString();
}

function buildHtml(l) {
  const price = fmtPrice(l.price);
  const statusClass = (l.status || 'Active').toLowerCase();
  const slug = l._slug;
  const canon = `https://sundgrenrealty.com/listings/${slug}/`;
  const heroImg = l.photoUrl;
  const metaDesc = `${l.sqft ? parseInt(l.sqft).toLocaleString() + ' sq ft ' : ''}commercial property at ${l.address}. ${price}. Listed by ${l.agent} with Sundgren Realty.`;

  const metaItems = [
    `<li><i class="fas fa-tag"></i><div><span class="mlabel">Price</span>${price}</div></li>`,
    l.sqft ? `<li><i class="fas fa-ruler-combined"></i><div><span class="mlabel">Sq Ft</span>${parseInt(l.sqft).toLocaleString()}</div></li>` : '',
    l.acres ? `<li><i class="fas fa-expand-arrows-alt"></i><div><span class="mlabel">Lot Size</span>${l.acres} acres</div></li>` : '',
    `<li><i class="fas fa-info-circle"></i><div><span class="mlabel">Status</span>${l.status}</div></li>`,
    `<li><i class="fas fa-hashtag"></i><div><span class="mlabel">MLS#</span>${l.listingId}</div></li>`,
    `<li><i class="fas fa-phone"></i><div><span class="mlabel">Questions?</span><a href="tel:3163217112" style="color:var(--yellow-dark);">316-321-7112</a></div></li>`,
  ].filter(Boolean).join('\n              ');

  const detailItems = [
    `<li><strong>Address:</strong> ${l.address}</li>`,
    l.sqft ? `<li><strong>Square Footage:</strong> ${parseInt(l.sqft).toLocaleString()} sq ft</li>` : '',
    l.acres ? `<li><strong>Lot Size:</strong> ${l.acres} acres</li>` : '',
    `<li><strong>Type:</strong> Commercial</li>`,
    `<li><strong>Status:</strong> ${l.status}</li>`,
    `<li><strong>Listing ID:</strong> ${l.listingId}</li>`,
  ].filter(Boolean).join('\n              ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${l.address} | Sundgren Realty &amp; Auction</title>
  <meta name="description" content="${metaDesc}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canon}">
  <meta property="og:title" content="${l.address} | Sundgren Realty &amp; Auction">
  <meta property="og:description" content="${metaDesc}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canon}">
  <meta property="og:image" content="${heroImg}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${heroImg}">
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
          <span class="pill pill-${statusClass}">${l.status.toUpperCase()}</span>
          <h1 style="color:#fff;font-size:clamp(22px,4vw,38px);font-weight:900;margin:0 0 10px;line-height:1.2;">${l.address}</h1>
          <nav aria-label="Breadcrumb" style="margin-top:16px;">
            <ol class="breadcrumb">
              <li><a href="/">Home</a></li>
              <li><a href="/listings/">Listings</a></li>
              <li class="active">${l.street}, ${l.city}</li>
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

          <p style="font-size:13px;color:var(--text-light);margin:0 0 16px;font-style:italic;"><i class="fas fa-user" style="margin-right:6px;color:var(--yellow-dark);"></i>Listed by ${l.agent} with Sundgren Realty | MLS# ${l.listingId}</p>

          <div class="desc-section">
            <h3 class="desc-section-title"><i class="fas fa-building"></i> Property Description</h3>
            <p>${l.description}</p>
          </div>

          <div class="desc-section">
            <h3 class="desc-section-title"><i class="fas fa-ruler-combined"></i> Property Details</h3>
            <ul>
              ${detailItems}
            </ul>
          </div>

          <div class="desc-section">
            <h3 class="desc-section-title"><i class="fas fa-map-marker-alt"></i> Location</h3>
            <p>Located in ${l.city}, Kansas — serving south central Kansas and surrounding communities. Contact Sundgren Realty for a showing or more information.</p>
          </div>

          <div class="desc-section">
            <h3 class="desc-section-title"><i class="fas fa-info-circle"></i> Listing Information</h3>
            <p style="font-size:13px;color:var(--text-light);line-height:1.7;">Listing ID ${l.listingId}. Courtesy of ${l.agent} with Sundgren Realty. Data provided by SCKMLS. All information deemed reliable but not guaranteed and should be independently verified. Subject to prior sale, change, or withdrawal.</p>
          </div>
        </div>

        <div>
          <div class="info-card">
            <h4>Listing Details</h4>
            <ul class="meta-list">
              ${metaItems}
            </ul>
            <a href="${l.detailUrl}" target="_blank" rel="noopener" class="btn-bid">View Full MLS Listing &rarr;</a>
            <a href="${l.photoGalleryUrl}" target="_blank" rel="noopener" class="btn-all" style="margin-top:8px;display:block;text-align:center;padding:10px;background:var(--bg-light);border-radius:6px;text-decoration:none;color:var(--dark);font-size:13px;font-weight:600;"><i class="fas fa-images" style="margin-right:6px;color:var(--yellow-dark);"></i>View Photo Gallery</a>
            <a href="mailto:realty@sundgren.com?subject=Question about ${encodeURIComponent(l.address)} (MLS ${l.listingId})" class="btn-all" style="margin-top:8px;display:block;text-align:center;padding:10px;background:var(--bg-light);border-radius:6px;text-decoration:none;color:var(--dark);font-size:13px;font-weight:600;"><i class="fas fa-envelope" style="margin-right:6px;color:var(--yellow-dark);"></i>Email an Agent</a>
            <a href="/listings/" class="btn-all">&larr; All Listings</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="cta-dark">
    <div class="container">
      <h2>Interested in This Property?</h2>
      <p>Our team knows the South Central Kansas market inside and out. Reach out for a no-pressure conversation.</p>
      <a href="/contact-us/" class="btn-yellow">Contact Our Team</a>
      <a href="/listings/" class="btn-outline-white">&larr; All Listings</a>
    </div>
  </section>

</main>

<!-- FOOTER -->

</body>
</html>`;
}

for (const l of listings) {
  const dir = `./listings/${l._slug}`;
  fs.writeFileSync(`${dir}/index.html`, buildHtml(l), 'utf8');
  console.log(`Fixed: ${l._slug}`);
}
console.log('Done');
