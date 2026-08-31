import fs from 'fs';

// ── Fix 1: Add info-card--sticky class to the contact card ──
let gen = fs.readFileSync('generate-repliers-listings.mjs', 'utf8');
gen = gen.replace(/\r\n/g, '\n');

const oldCard = `<div class="info-card">
      <h4 style="margin:0 0 4px;font-size:17px;">Interested in this property?</h4>`;
const newCard = `<div class="info-card info-card--sticky">
      <h4 style="margin:0 0 4px;font-size:17px;">Interested in this property?</h4>`;

if (gen.includes(oldCard)) {
  gen = gen.replace(oldCard, newCard);
  console.log('contact card: sticky class added');
} else {
  console.log('WARN: contact card old text not found');
}

fs.writeFileSync('generate-repliers-listings.mjs', gen, 'utf8');

// ── Fix 2: Chat widget — bump everything 15% ──
let footer = fs.readFileSync('_partials/footer.html', 'utf8');
footer = footer.replace(/\r\n/g, '\n');

// img avatar: 42px → 48px
footer = footer.replace('width: 42px;\n    height: 42px;', 'width: 48px;\n    height: 48px;');
// bubble text: 13px → 15px
footer = footer.replace('font-size: 13px;', 'font-size: 15px;');
// bubble max-width: 240px → 276px
footer = footer.replace('max-width: 240px;', 'max-width: 276px;');
// bubble padding: 12px 16px → 14px 18px
footer = footer.replace('padding: 12px 16px;', 'padding: 14px 18px;');
// btn font-size: 14px → 16px
footer = footer.replace('font-size: 14px;\n    padding: 11px 20px;', 'font-size: 16px;\n    padding: 13px 23px;');
// btn icon size: 16px → 18px
footer = footer.replace('font-size: 16px;\n  }', 'font-size: 18px;\n  }');
// bottom/right position: 24px → 28px
footer = footer.replace('bottom: 24px;\n    right: 24px;', 'bottom: 28px;\n    right: 28px;');

fs.writeFileSync('_partials/footer.html', footer, 'utf8');
console.log('chat widget: 15% size bump done');
