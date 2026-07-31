const raw = "Auction Date: BIDDING ENDS WEDNESDAY AUGUST 5, 2026 4:00 PM Auction Location: ONLINE ONLY AUCTION: Download The Sundgren Realty App Today! HF Chip Crum and Nancy J Crum, Sellers PROPERTY DESCRIPTION: 158 acres of diverse Elk County, Kansas land located southeast of Piedmont and northwest of Howard. Features include good quality native hay meadow, with a strong stand of bluestem grasses. LEGAL DESCRIPTION: The Northeast Quarter of Section 29, Township 28 South, Range 10 East of the 6th P.M., Elk County, Kansas. Subject to public road. 2025 REAL ESTATE TAXES: $594.46 LAND LOCATION FROM PIEDMONT: South on K Rd (Road 10) to Turkey, east 1 1/2 miles to the property. LAND LOCATION FROM HOWARD: 8 miles north on HWY 99 to Turkey, west 4 miles to the property. TERMS: This will be an online only auction. Bidding will be by the acre.";

const markerRe = /(PROPERTY DESCRIPTION|LEGAL DESCRIPTION|LAND LOCATION[^:]{0,40}?|REAL ESTATE TAXES|TERMS|PICKUP|REMOVAL|PAYMENT|PREVIEW|INSPECTION|BIDDING|SHIPPING|NOTES?|DIRECTIONS?):/g;

const parts = raw.split(markerRe);
let preText = parts[0].trim();
const namedSections = [];
for (let j = 1; j < parts.length; j += 2) {
  namedSections.push({ title: parts[j].trim(), body: (parts[j+1] || '').trim() });
}

console.log('PRE:', preText);
console.log('---SECTIONS:');
namedSections.forEach(s => console.log(' [' + s.title + '] ' + s.body.substring(0,80)));

let freeText = preText;
let auctionDate = '';
let auctionLocation = '';

freeText = freeText.replace(/Auction Date:\s*(.+?)(?=Auction Location:|$)/i, (_, v) => {
  auctionDate = v.trim();
  return '';
});
freeText = freeText.replace(/Auction Location:\s*(.+?)(?=Auction Date:|$)/i, (_, v) => {
  auctionLocation = v.trim();
  return '';
});

console.log('\nAuction Date:', auctionDate);
console.log('Auction Location raw:', auctionLocation);

let onlineOnly = false;
if (/ONLINE ONLY AUCTION/i.test(auctionLocation)) {
  onlineOnly = true;
  auctionLocation = auctionLocation.replace(/ONLINE ONLY AUCTION:\s*Download[^.!]*[.!]?/gi, '').trim();
}
console.log('Online Only:', onlineOnly);
console.log('Location cleaned:', auctionLocation);

freeText = freeText.replace(/\s{2,}/g,' ').trim();
const sellersMatch = freeText.match(/([A-Z][^,]+(?:,\s*[A-Z][^,]+)*),\s*Sellers?/i);
console.log('Sellers:', sellersMatch ? sellersMatch[0] : 'none in: ' + freeText.substring(0,100));
