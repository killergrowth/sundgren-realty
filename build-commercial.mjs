import fs from 'fs';

function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').trim().substring(0,80); }
function fmtPrice(p) { if(!p) return 'Contact for Price'; return '$' + parseInt(p).toLocaleString(); }

const listings = [
  {
    listingId: '669041',
    street: '219 S Haverhill Rd',
    city: 'El Dorado',
    zip: '67042',
    price: '99000',
    status: 'Active',
    sqft: '3220',
    acres: '0.73',
    agent: 'Audrey',
    description: 'High visibility frontage at 219 S Haverhill in El Dorado! PRIME location across the street from BG Products Stadium. The 3/4 acre lot offers what could be combined into one or left as two separate parcels with great potential for retail, office, or redevelopment.',
    photoUrl: 'https://s3.amazonaws.com/mlsphotos.idxbroker.com/photos/f7b7/7b7f8a0db7bcd1d8259ffb5f5bb4891b/c147',
    detailUrl: 'https://realestate.sundgren.com/idx/details/listing/c147/669041/219-S-Haverhill-Rd-El-Dorado-Kansas',
    photoGalleryUrl: 'https://realestate.sundgren.com/idx/photogallery/c147/669041',
    type: 'commercial',
  },
  {
    listingId: '660706',
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
    type: 'commercial',
  },
  {
    listingId: '635999',
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
    type: 'commercial',
  },
];

let built = 0;

for (const l of listings) {
  l.address = `${l.street}, ${l.city}, KS ${l.zip}`;
  const slug = `${slugify(l.street)}-${slugify(l.city)}-ks`.substring(0, 80);
  const dir = `./listings/${slug}`;

  if (fs.existsSync(dir)) {
    console.log('SKIP:', slug);
    continue;
  }

  fs.mkdirSync(dir, { recursive: true });

  const price = fmtPrice(l.price);
  const metaDesc = `${l.sqft ? parseInt(l.sqft).toLocaleString() + ' sq ft ' : ''}commercial property at ${l.address}. ${price}. Listed by ${l.agent} with Sundgren Realty.`;
  const canon = `https://sundgrenrealty.com/listings/${slug}/`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${l.address} | Sundgren Realty</title>
  <meta name="description" content="${metaDesc}">
  <link rel="canonical" href="${canon}">
  <meta property="og:title" content="${l.address} | Sundgren Realty">
  <meta property="og:image" content="${l.photoUrl}">
  <link rel="stylesheet" href="/css/sundgren.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" crossorigin="anonymous">
</head>
<body>
<!-- HEADER -->
<main>
  <section class="auction-hero" style="background-image:url('${l.photoUrl}')">
    <div class="hero-inner"><div class="container"><div style="max-width:700px;margin:0 auto;text-align:center;">
      <span class="pill pill-active">${l.status.toUpperCase()}</span>
      <h1 style="color:#fff;font-size:clamp(22px,4vw,38px);font-weight:900;margin:0 0 10px;">${l.address}</h1>
      <nav aria-label="Breadcrumb" style="margin-top:16px;"><ol class="breadcrumb"><li><a href="/">Home</a></li><li><a href="/listings/">Listings</a></li><li class="active">${l.street}, ${l.city}</li></ol></nav>
    </div></div></div>
  </section>

  <section style="background:#f5f5f5;padding:20px 0;"><div class="container">
    <img src="${l.photoUrl}" alt="${l.address}" style="width:100%;max-height:400px;object-fit:cover;border-radius:8px;" loading="lazy">
    <p style="font-size:12px;text-align:right;margin:8px 0 0;"><a href="${l.photoGalleryUrl}" target="_blank" rel="noopener" style="color:var(--red);font-weight:700;">View All Photos &rarr;</a></p>
  </div></section>

  <section class="section"><div class="container"><div class="auction-detail-grid">
    <div>
      <h2 style="font-size:20px;font-weight:800;color:var(--dark);margin:0 0 16px;padding-bottom:10px;border-bottom:2px solid #FFD700;">About This Property</h2>
      <p style="font-size:13px;color:var(--text-light);margin:0 0 16px;font-style:italic;"><i class="fas fa-user" style="margin-right:6px;color:var(--yellow-dark);"></i>Listing courtesy of ${l.agent} with Sundgren Realty</p>

      <div style="margin-bottom:18px;padding:16px 20px;background:var(--bg-light);border-radius:8px;border-left:4px solid var(--yellow);">
        <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--dark);margin:0 0 10px;"><i class="fas fa-building" style="color:var(--yellow-dark);margin-right:6px;"></i>Property Description</h3>
        <p style="font-size:14px;line-height:1.75;color:var(--text);margin:0;">${l.description}</p>
      </div>

      <div style="margin-bottom:18px;padding:16px 20px;background:var(--bg-light);border-radius:8px;border-left:4px solid var(--yellow);">
        <h3 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--dark);margin:0 0 10px;">Property Details</h3>
        <ul style="margin:0;padding-left:0;list-style:none;display:flex;flex-direction:column;gap:6px;">
          <li style="font-size:14px;color:var(--text);"><strong>Address:</strong> ${l.address}</li>
          ${l.sqft ? `<li style="font-size:14px;color:var(--text);"><strong>Square Footage:</strong> ${parseInt(l.sqft).toLocaleString()} sq ft</li>` : ''}
          ${l.acres ? `<li style="font-size:14px;color:var(--text);"><strong>Lot Size:</strong> ${l.acres} acres</li>` : ''}
          <li style="font-size:14px;color:var(--text);"><strong>Type:</strong> Commercial</li>
          <li style="font-size:14px;color:var(--text);"><strong>Status:</strong> ${l.status}</li>
          <li style="font-size:14px;color:var(--text);"><strong>Listing ID:</strong> ${l.listingId}</li>
        </ul>
      </div>

      <div style="margin-top:20px;">
        <a href="${l.detailUrl}" target="_blank" rel="noopener" class="btn-yellow" style="display:inline-block;margin-right:10px;">View Full MLS Details &rarr;</a>
        <a href="${l.photoGalleryUrl}" target="_blank" rel="noopener" class="btn-outline" style="display:inline-block;">Photo Gallery</a>
      </div>
    </div>

    <div>
      <div style="background:var(--bg-light);border-radius:12px;padding:24px;margin-bottom:24px;">
        <div style="font-size:28px;font-weight:900;color:var(--dark);margin-bottom:4px;">${price}</div>
        <div style="font-size:14px;color:var(--text-light);margin-bottom:20px;">Listed Price</div>
        <a href="/contact-us/" class="btn-yellow" style="display:block;text-align:center;margin-bottom:10px;">Contact an Agent</a>
        <a href="/listings/" class="btn-outline" style="display:block;text-align:center;">Browse More Listings</a>
      </div>
      <div style="background:var(--bg-light);border-radius:12px;padding:24px;">
        <h3 style="font-size:15px;font-weight:800;color:var(--dark);margin:0 0 12px;">Listing Agent</h3>
        <p style="font-size:14px;color:var(--text);margin:0 0 4px;"><strong>${l.agent}</strong></p>
        <p style="font-size:13px;color:var(--text-light);margin:0 0 12px;">Sundgren Realty &amp; Auction</p>
        <a href="/agents/" style="font-size:13px;color:var(--red);font-weight:700;text-decoration:none;">View Our Agents &#8594;</a>
      </div>
    </div>
  </div></div></section>

  <section class="cta-dark"><div class="container">
    <h2>Interested in This Property?</h2>
    <p>Our agents know South Central Kansas real estate inside and out. Reach out for a showing or more information.</p>
    <a href="/contact-us/" class="btn-yellow">Contact Our Team</a>
    <a href="/listings/" class="btn-outline-white">Browse All Listings</a>
  </div></section>
</main>
<!-- FOOTER -->
</body>
</html>`;

  fs.writeFileSync(`${dir}/index.html`, html, 'utf8');
  console.log('BUILT:', slug);
  built++;
}

const total = fs.readdirSync('./listings').filter(d => { try { return fs.statSync('./listings/'+d).isDirectory(); } catch(e) { return false; } }).length;
console.log(`\nBuilt: ${built} | Total listing dirs: ${total}`);
