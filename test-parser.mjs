import fs from 'fs';

// Inline the parseDescription function by dynamic import
// We'll test by running a quick version inline

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function parseDescription(raw) {
  let text = String(raw || '').replace(/<[^>]+>/g, ' ');
  text = text
    .replace(/\u00c2\u00a0/g, ' ').replace(/\u00c2/g, '').replace(/\u00a0/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ').trim();

  function escH(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  const markerRe = /(PROPERTY DESCRIPTION|PROPERTY ADDRESS|LEGAL DESCRIPTION|LAND FEATURES|LAND LOCATION FROM[^:]{0,60}|LAND LOCATION[^:]{0,40}|REAL ESTATE TAXES|MANNER OF AUCTION|PERSONAL PROPERTY AUCTION|TRACTS?\s+[\d,&\s]+LOCATION FROM[^:]{0,40}|TRACT \d+[^:]{0,30}|TERMS|PICKUP|REMOVAL|PAYMENT|PREVIEW|INSPECTION|BIDDING|SHIPPING|NOTES?|DIRECTIONS?):/g;
  const parts = text.split(markerRe);

  let preText = parts[0].trim();
  const namedSections = [];
  for (let j = 1; j < parts.length; j += 2) {
    namedSections.push({ title: parts[j].trim(), body: (parts[j+1] || '').trim() });
  }

  const openHouseLines = [];
  preText = preText.replace(/OPEN HOUSE\s+[^O][^P]?[^E]?[^N]?(?:(?!OPEN HOUSE|PROPERTY|LEGAL|LAND|TERMS|TRACT|MANNER|PERSONAL).)*?(?=OPEN HOUSE|PROPERTY|LEGAL|LAND|TERMS|TRACT|MANNER|PERSONAL|$)/gi, (match) => {
    const clean = match.trim();
    if (clean) openHouseLines.push(clean);
    return '';
  });

  let auctionDate = '', auctionLocation = '', onlineOnly = false, sellers = '';
  let freeText = preText;

  freeText = freeText.replace(/Auction Date:\s*([^A-Z][^:]*?)(?=Auction Location:|$)/i, (_, v) => { auctionDate = v.trim(); return ''; });
  freeText = freeText.replace(/Auction Location:\s*(.*?)(?=Auction Date:|$)/i, (_, v) => { auctionLocation = v.trim(); return ''; });
  if (!auctionDate) freeText = freeText.replace(/Auction Date:\s*(.+)/i, (_, v) => { auctionDate = v.trim(); return ''; });
  if (!auctionLocation) freeText = freeText.replace(/Auction Location:\s*(.+)/i, (_, v) => { auctionLocation = v.trim(); return ''; });

  if (/ONLINE ONLY AUCTION/i.test(freeText) || /ONLINE ONLY AUCTION/i.test(auctionLocation)) {
    onlineOnly = true;
    freeText = freeText.replace(/ONLINE ONLY AUCTION:\s*Download[^.!]*[.!]?/gi, '').trim();
    auctionLocation = auctionLocation.replace(/ONLINE ONLY AUCTION:\s*Download[^.!]*[.!]?/gi, '').trim();
    auctionLocation = auctionLocation.replace(/^ONLINE ONLY AUCTION[:\s]*/i, '').trim();
  }

  const sellerRe = /\b((?:Estate of [A-Za-z .'-]+|[A-Z][A-Za-z .'-]+(?:\s+(?:LLC|Inc|Trust|Co))?)),\s*Sellers?\s*$/i;
  const sellersAtEnd = auctionLocation.match(sellerRe);
  if (sellersAtEnd) {
    sellers = sellersAtEnd[1].trim() + ', Sellers';
    auctionLocation = auctionLocation.slice(0, sellersAtEnd.index).trim();
  } else {
    const sellersInFree = freeText.match(sellerRe);
    if (sellersInFree) {
      sellers = sellersInFree[1].trim() + ', Sellers';
      freeText = freeText.replace(sellersInFree[0], '').trim();
    }
  }
  freeText = freeText.replace(/\s{2,}/g, ' ').trim();

  const tractSections = namedSections.filter(s => /^TRACT \d/i.test(s.title));
  const landLocSections = namedSections.filter(s =>
    /^LAND LOCATION FROM/i.test(s.title) || /^TRACTS?\s+[\d,&\s]+LOCATION FROM/i.test(s.title)
  );
  const regularSections = namedSections.filter(s => !tractSections.includes(s) && !landLocSections.includes(s));

  return {
    sellers, openHouseLines, auctionLocation, auctionDate, onlineOnly,
    tractSections: tractSections.map(s=>s.title),
    landLocSections: landLocSections.map(s=>s.title),
    regularSections: regularSections.map(s=>s.title),
    freeText: freeText.slice(0,100),
  };
}

const descs = [
  { id: 165887, text: 'Auction Date: FRIDAY AUGUST 21, 2026 11:00 AM (REAL ESTATE SELLS AT NOON) Auction Location: 438 E MAIN ST, MOUNT HOPE, KS 67108 Estate of Leslie C. Dick III, Seller OPEN HOUSE WEDNESDAY AUGUST 12 4-6PM PROPERTY ADDRESS: 438 E Main St, Mount Hope, KS 67108 PROPERTY DESCRIPTION: Sitting on just over an acre. LEGAL DESCRIPTION: Lots 10, 11. 2025 REAL ESTATE TAXES: $3,738.98 TERMS: Live on-site auction.' },
  { id: 166365, text: 'Auction Date: SATURDAY AUGUST 29, 2026 10:00 AM Auction Location: 8227 N. Rock Rd., Walton, KS 67151 (On-Site) JBAR LLC, Seller OPEN HOUSE THURSDAY AUGUST 13, 4PM TO 6PM OPEN HOUSE WEDNESDAY AUGUST 27, 4PM TO 6PM PROPERTY DESCRIPTION: 155+- acres. LAND FEATURES: 116 acres tillable. LEGAL DESCRIPTION: NE/4. REAL ESTATE TAXES: $2,834.24 LAND LOCATION FROM WALTON: Northeast on HWY 50. LAND LOCATION FROM NEWTON: Northeast on HWY 50 past Walton. LAND LOCATION FROM PEABODY: West/Southwest. PERSONAL PROPERTY AUCTION: Large personal property auction. TERMS: Live auction.' },
  { id: 166378, text: 'Auction Date: TUESDAY SEPTEMBER 1, 2026 4:00 PM Auction Location: DOUGLASS COMMUNITY BUILDING, 206 S. FORREST ST, DOUGLASS KS 67039 Estate of Max Brown, Seller OPEN HOUSE THURSDAY AUGUST 6, 4PM TO 6PM OPEN HOUSE WEDNESDAY AUGUST 26, 4PM TO 6PM TRACT 1: House, Shop & Barn on 5+- Acres TRACT 2: 66+- Acres - Pasture TRACT 3: 120+- Acres - Pond TRACT 4: 160+- Acres - Pasture TRACTS 1, 2 & 3 LOCATION FROM DOUGLASS: North 1 mile on HWY 77. MANNER OF AUCTION: These Tracts will sell individually. TERMS: Selling tract 1 by total dollars.' },
];

for (const d of descs) {
  console.log(`\n=== ID ${d.id} ===`);
  const r = parseDescription(d.text);
  console.log('sellers:', r.sellers || '(none)');
  console.log('location:', r.auctionLocation || '(none)');
  console.log('openHouses:', r.openHouseLines);
  console.log('tracts:', r.tractSections);
  console.log('landLoc:', r.landLocSections);
  console.log('regular:', r.regularSections);
  console.log('freeText:', r.freeText || '(none)');
}
