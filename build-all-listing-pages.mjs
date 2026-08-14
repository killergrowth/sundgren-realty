/**
 * build-all-listing-pages.mjs
 * Scrapes all IDX pages via Firecrawl, extracts Sundgren-only listings,
 * and generates individual listing pages.
 *
 * Usage: node build-all-listing-pages.mjs
 */

import fs from 'fs';
import path from 'path';

const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
const TOTAL_PAGES = 20;
const BASE_URL = 'https://realestate.sundgren.com/i/residential-property';
const LAND_URL = 'https://realestate.sundgren.com/i/land-listings';

// Already-built listing IDs to skip
const ALREADY_BUILT = new Set([
  '672300', '676431', '672322', // hand-built existing
]);

// Slugify address for directory name
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

function formatPrice(price) {
  if (!price) return 'Contact for Price';
  return '$' + parseInt(price).toLocaleString();
}

function parseListingsFromMarkdown(markdown) {
  const listings = [];

  // Split into blocks by listing image pattern
  const blocks = markdown.split(/(?=\[!\[)/);

  for (const block of blocks) {
    if (!block.includes('Sundgren Realty')) continue;
    if (!block.includes('Listing ID')) continue;

    // Extract address and detail URL
    const detailMatch = block.match(/\[([^,\]]+(?:,[^,\]]+)*),\s*Kansas\s+KS\s+(\d{5})\]\((https:\/\/realestate\.sundgren\.com\/idx\/details\/listing\/c147\/(\d+)\/[^)]+)\)/);
    if (!detailMatch) {
      // Try alternate format
      const alt = block.match(/Listing ID(\d+)[\s\S]*?Listing courtesy of (\w+) with Sundgren Realty/);
      if (!alt) continue;
    }

    const address = detailMatch ? detailMatch[1] : '';
    const zip = detailMatch ? detailMatch[2] : '';
    const detailUrl = detailMatch ? detailMatch[3] : '';
    const listingId = detailMatch ? detailMatch[4] : block.match(/Listing ID(\d+)/)?.[1] || '';

    if (!listingId) continue;

    const photoMatch = block.match(/!\[[^\]]*\]\((https:\/\/s3\.amazonaws\.com\/mlsphotos[^)]+)\)/);
    const priceMatch = block.match(/Price\$([0-9,]+)/);
    const statusMatch = block.match(/Status(Active|Pending|Sold)/i);
    const bedsMatch = block.match(/Bedrooms(\d+)/);
    const bathsMatch = block.match(/Total Baths(\d+)/);
    const sqftMatch = block.match(/SqFt\s*\n([\d,]+)/);
    const acresMatch = block.match(/Acres\s*\n([\d.]+)/);
    const agentMatch = block.match(/Listing courtesy of (\w+) with Sundgren Realty/);
    const descMatch = block.match(/Subdivision[^\n]*\n\n([^[]{20,500})/);

    const addrParts = address ? address.split(',').map(p => p.trim()) : ['', ''];

    listings.push({
      address: address ? `${address}, KS ${zip}` : '',
      street: addrParts[0] || '',
      city: addrParts[addrParts.length - 1] || '',
      zip: zip || '',
      listingId,
      detailUrl: detailUrl || `https://realestate.sundgren.com/idx/details/listing/c147/${listingId}/`,
      photoUrl: photoMatch ? photoMatch[1] : '',
      price: priceMatch ? priceMatch[1].replace(/,/g, '') : '',
      status: statusMatch ? statusMatch[1] : 'Active',
      beds: bedsMatch ? bedsMatch[1] : '',
      baths: bathsMatch ? bathsMatch[1] : '',
      sqft: sqftMatch ? sqftMatch[1].replace(/,/g, '') : '',
      acres: acresMatch ? acresMatch[1] : '',
      agent: agentMatch ? agentMatch[1] : '',
      description: descMatch ? descMatch[1].trim().replace(/\.\.\.$/, '').trim() : '',
      photoGalleryUrl: `https://realestate.sundgren.com/idx/photogallery/c147/${listingId}`,
    });
  }

  return listings;
}

async function scrapePageFirecrawl(url) {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FIRECRAWL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: false,
      proxy: 'stealth',
      timeout: 30000,
    }),
  });

  if (!res.ok) {
    console.error(`Firecrawl error ${res.status} for ${url}`);
    return '';
  }

  const data = await res.json();
  return data?.data?.markdown || '';
}

function buildPageHtml(listing) {
  const slug = buildSlug(listing);
  const canonicalUrl = `https://sundgrenrealty.com/listings/${slug}/`;
  const price = formatPrice(listing.price);
  const statusClass = (listing.status || 'Active').toLowerCase();
  const statusLabel = (listing.status || 'Active').toUpperCase();
  const shortAddr = listing.street ? `${listing.street}, ${listing.city}` : listing.address;

  const heroImg = listing.photoUrl
    ? listing.photoUrl
    : '/images/hero-house.jpg';

  const statsHtml = [
    listing.beds ? `<div style="background:#fff;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--dark);">${listing.beds}</div><div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:.05em;">Beds</div></div>` : '',
    listing.baths ? `<div style="background:#fff;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--dark);">${listing.baths}</div><div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:.05em;">Baths</div></div>` : '',
    listing.sqft ? `<div style="background:#fff;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--dark);">${parseInt(listing.sqft).toLocaleString()}</div><div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:.05em;">Sq Ft</div></div>` : '',
    listing.acres && parseFloat(listing.acres) > 0 ? `<div style="background:#fff;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--dark);">${listing.acres}</div><div style="font-size:11px;color:var(--text-light);text-transform:uppercase;letter-spacing:.05em;">Acres</div></div>` : '',
  ].filter(Boolean).join('\n');

  const detailItems = [
    `<li><strong>Address:</strong> ${listing.address}</li>`,
    listing.beds ? `<li><strong>Bedrooms:</strong> ${listing.beds}</li>` : '',
    listing.baths ? `<li><strong>Bathrooms:</strong> ${listing.baths}</li>` : '',
    listing.sqft ? `<li><strong>Square Footage:</strong> ${parseInt(listing.sqft).toLocaleString()} sq ft</li>` : '',
    listing.acres && parseFloat(listing.acres) > 0 ? `<li><strong>Lot Size:</strong> ${listing.acres} acres</li>` : '',
    `<li><strong>Status:</strong> ${listing.status || 'Active'}</li>`,
    `<li><strong>Listing ID:</strong> ${listing.listingId}</li>`,
  ].filter(Boolean).join('\n              ');

  const propDesc = listing.description
    ? listing.description.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    : `${listing.address} is a great property in ${listing.city}, Kansas. Contact Sundgren Realty for full details and to schedule a showing.`;

  const metaDesc = `${listing.beds ? listing.beds + ' bed, ' : ''}${listing.baths ? listing.baths + ' bath' : ''}${listing.sqft ? ', ' + parseInt(listing.sqft).toLocaleString() + ' sq ft' : ''} home${listing.acres && parseFloat(listing.acres) > 0.5 ? ' on ' + listing.acres + ' acres' : ''} at ${listing.address}. ${price}. Listed by ${listing.agent || 'Sundgren'} with Sundgren Realty.`;

  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "name": listing.address,
    "url": canonicalUrl,
    "description": metaDesc,
    "offers": { "@type": "Offer", "price": listing.price || "0", "priceCurrency": "USD" },
    "address": { "@type": "PostalAddress", "streetAddress": listing.street, "addressLocality": listing.city, "addressRegion": "KS", "postalCode": listing.zip, "addressCountry": "US" },
    ...(listing.beds ? { "numberOfRooms": parseInt(listing.beds) } : {}),
    ...(listing.sqft ? { "floorSize": { "@type": "QuantitativeValue", "value": parseInt(listing.sqft), "unitCode": "SQFT" } } : {}),
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${listing.address} | Sundgren Realty</title>
  <meta name="description" content="${metaDesc}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:title" content="${listing.address} | Sundgren Realty">
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

  <section style="background:#f5f5f5;padding:20px 0;">
    <div class="container">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
        <img src="${heroImg}" alt="${listing.address}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;" loading="lazy">
        <div style="width:100%;aspect-ratio:4/3;background:#e5e5e5;border-radius:6px;display:flex;align-items:center;justify-content:center;"><a href="${listing.photoGalleryUrl}" target="_blank" rel="noopener" style="color:var(--red);font-weight:700;text-decoration:none;font-size:13px;text-align:center;padding:10px;">View All Photos &rarr;</a></div>
      </div>
      <p style="font-size:12px;color:var(--text-light);text-align:right;margin:8px 0 0;"><a href="${listing.photoGalleryUrl}" target="_blank" rel="noopener" style="color:var(--red);font-weight:700;">View All Photos &rarr;</a></p>
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

          <p style="font-size:13px;color:var(--text-light);margin:0 0 16px;font-style:italic;"><i class="fas fa-user" style="margin-right:6px;color:var(--yellow-dark);"></i>Listing courtesy of ${listing.agent || 'Sundgren Realty'} with Sundgren Realty</p>

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
            <p>Located in ${listing.city}, Kansas &#8212; serving south central Kansas and surrounding communities. Contact Sundgren Realty for a showing or more information.</p>
          </div>

          <div style="margin-top:20px;">
            <a href="${listing.detailUrl}" target="_blank" rel="noopener" class="btn-yellow" style="display:inline-block;margin-right:10px;">View Full MLS Details &rarr;</a>
            <a href="${listing.photoGalleryUrl}" target="_blank" rel="noopener" class="btn-outline" style="display:inline-block;">Photo Gallery</a>
          </div>
        </div>

        <div>
          <div style="background:var(--bg-light);border-radius:12px;padding:24px;margin-bottom:24px;">
            <div style="font-size:28px;font-weight:900;color:var(--dark);margin-bottom:4px;">${price}</div>
            <div style="font-size:14px;color:var(--text-light);margin-bottom:20px;">Listed Price</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
              ${statsHtml}
            </div>
            <a href="/contact-us/" class="btn-yellow" style="display:block;text-align:center;margin-bottom:10px;">Contact an Agent</a>
            <a href="/listings/" class="btn-outline" style="display:block;text-align:center;">Browse More Listings</a>
          </div>

          <div style="background:var(--bg-light);border-radius:12px;padding:24px;">
            <h3 style="font-size:15px;font-weight:800;color:var(--dark);margin:0 0 12px;">Listing Agent</h3>
            <p style="font-size:14px;color:var(--text);margin:0 0 4px;"><strong>${listing.agent || 'Sundgren Agent'}</strong></p>
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

async function main() {
  const allListings = [];
  const seenIds = new Set();

  // Already-built IDs from existing directories
  const existingDirs = fs.readdirSync('./listings').filter(d => fs.statSync(`./listings/${d}`).isDirectory());
  console.log(`Existing listing dirs: ${existingDirs.length}`);

  // Scrape residential pages 1-20
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const url = page === 1 ? BASE_URL : `${BASE_URL}?start=${page}`;
    console.log(`Scraping page ${page}/${TOTAL_PAGES}: ${url}`);

    const markdown = await scrapePageFirecrawl(url);
    if (!markdown) {
      console.log(`  No content returned, skipping`);
      continue;
    }

    const listings = parseListingsFromMarkdown(markdown);
    console.log(`  Found ${listings.length} Sundgren listings`);

    for (const l of listings) {
      if (!seenIds.has(l.listingId) && l.listingId) {
        seenIds.add(l.listingId);
        allListings.push({ ...l, type: 'residential' });
      }
    }

    // Small delay to be polite
    await new Promise(r => setTimeout(r, 1000));
  }

  // Scrape land listings
  console.log(`\nScraping land listings...`);
  const landMd = await scrapePageFirecrawl(LAND_URL);
  if (landMd) {
    const landListings = parseListingsFromMarkdown(landMd);
    console.log(`  Found ${landListings.length} Sundgren land listings`);
    for (const l of landListings) {
      if (!seenIds.has(l.listingId) && l.listingId) {
        seenIds.add(l.listingId);
        allListings.push({ ...l, type: 'land' });
      }
    }
  }

  console.log(`\nTotal unique Sundgren listings found: ${allListings.length}`);

  // Save full data
  fs.mkdirSync('./data', { recursive: true });
  fs.writeFileSync('./data/sundgren-listings-full.json', JSON.stringify(allListings, null, 2));

  // Generate pages
  let built = 0;
  let skipped = 0;

  for (const listing of allListings) {
    if (ALREADY_BUILT.has(listing.listingId)) {
      skipped++;
      continue;
    }

    const slug = buildSlug(listing);
    const dir = `./listings/${slug}`;

    if (fs.existsSync(dir)) {
      skipped++;
      continue;
    }

    if (!listing.address || !listing.listingId) {
      console.log(`SKIP (missing data): ${JSON.stringify(listing).substring(0, 100)}`);
      skipped++;
      continue;
    }

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/index.html`, buildPageHtml(listing), 'utf8');
    console.log(`BUILT: ${listing.address} → ${slug}`);
    built++;
  }

  console.log(`\nDone! Built: ${built}, Skipped: ${skipped}`);
}

main().catch(console.error);
