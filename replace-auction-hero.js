const fs = require('fs');
const path = require('path');

const auctionsDir = path.join(__dirname, 'auctions');
const dirs = fs.readdirSync(auctionsDir, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name);

let updated = 0, skipped = 0;

for (const slug of dirs) {
  const file = path.join(auctionsDir, slug, 'index.html');
  if (!fs.existsSync(file)) { skipped++; continue; }

  let html = fs.readFileSync(file, 'utf8');

  // Already converted
  if (!html.includes('class="auction-hero"')) { skipped++; continue; }

  // Extract the pill (status badge), h1 title, and breadcrumb ol from the auction-hero
  const pillMatch = html.match(/<span class="pill[^"]*">[^<]*<\/span>/);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const breadcrumbMatch = html.match(/<ol class="breadcrumb">([\s\S]*?)<\/ol>/);

  if (!h1Match || !breadcrumbMatch) {
    console.log('SKIP (no h1/breadcrumb):', slug);
    skipped++;
    continue;
  }

  const pill = pillMatch ? pillMatch[0] : '';
  const h1Text = h1Match[1].replace(/<[^>]+>/g, '').trim(); // plain text for the page-hero h1
  const breadcrumbInner = breadcrumbMatch[1];

  // Build the replacement page-hero
  const pageHero = `  <section class="page-hero">
    <div class="inner">
      ${pill ? pill + '\n      ' : ''}<h1>${h1Text}</h1>
      <nav aria-label="Breadcrumb">
        <ol class="breadcrumb">${breadcrumbInner}</ol>
      </nav>
    </div>
  </section>`;

  // Replace the entire auction-hero section (from opening <section class="auction-hero" to its closing </section>)
  html = html.replace(/<section class="auction-hero"[\s\S]*?<\/section>/, pageHero);

  fs.writeFileSync(file, html, 'utf8');
  updated++;
}

console.log(`Done. Updated: ${updated}, Skipped: ${skipped}`);
