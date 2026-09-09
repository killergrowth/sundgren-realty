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

  // Already has the right class or was converted to page-hero
  if (!html.includes('class="page-hero"')) { skipped++; continue; }

  // Extract h1 text, pill, and breadcrumb from the page-hero we built earlier
  const pillMatch = html.match(/<span class="pill[^"]*">[^<]*<\/span>/);
  const h1Match = html.match(/<h1>([^<]+)<\/h1>/);
  const breadcrumbMatch = html.match(/<ol class="breadcrumb">([\s\S]*?)<\/ol>/);

  if (!h1Match || !breadcrumbMatch) {
    console.log('SKIP (no h1/breadcrumb):', slug);
    skipped++;
    continue;
  }

  const pill = pillMatch ? pillMatch[0] : '';
  const title = h1Match[1].trim();
  const breadcrumbInner = breadcrumbMatch[1];

  // Build auction-hero listing-hero-solid structure
  const newHero = `  <section class="auction-hero listing-hero-solid">
    <div class="auction-hero-overlay"></div>
    <div class="hero-inner">
      <div class="container">
        <div class="auction-hero-content" style="max-width:800px;margin:0 auto;text-align:center;">
          ${pill ? pill + '\n          ' : ''}<h1 class="auction-hero-title">${title}</h1>
          <nav aria-label="Breadcrumb" style="margin-top:12px;">
            <ol class="breadcrumb" style="justify-content:center;">
              ${breadcrumbInner.trim()}
            </ol>
          </nav>
        </div>
      </div>
    </div>
  </section>`;

  // Replace the page-hero section
  html = html.replace(/<section class="page-hero">[\s\S]*?<\/section>/, newHero);

  fs.writeFileSync(file, html, 'utf8');
  updated++;
}

console.log(`Done. Updated: ${updated}, Skipped: ${skipped}`);
