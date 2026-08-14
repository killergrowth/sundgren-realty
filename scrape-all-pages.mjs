/**
 * scrape-all-pages.mjs
 * Uses firecrawl-equivalent fetch to scrape all 20 pages of residential + land
 * and extract only Sundgren-listed properties.
 * 
 * Since we can't run firecrawl from Node directly, this script
 * processes the already-scraped text data passed via stdin or a file.
 * 
 * Usage: node scrape-all-pages.mjs
 */

import fs from 'fs';

// Parse a firecrawl markdown page into listing objects
function parseListings(markdown) {
  const listings = [];
  
  // Split on listing image links pattern
  const blocks = markdown.split(/\n\n(?=\[!\[)/);
  
  for (const block of blocks) {
    // Only process Sundgren Realty listings
    if (!block.includes('Sundgren Realty')) continue;
    if (!block.includes('Listing ID')) continue;
    
    // Extract detail URL and address
    const detailMatch = block.match(/\[([^\]]+),\s*Kansas\s+KS\s+(\d{5})\]\((https:\/\/realestate\.sundgren\.com\/idx\/details\/listing\/c147\/(\d+)\/[^)]+)\)/);
    if (!detailMatch) continue;
    
    const address = detailMatch[1];
    const zip = detailMatch[2];
    const detailUrl = detailMatch[3];
    const listingId = detailMatch[4];
    
    // Parse city/state from address
    const addrParts = address.split(',').map(p => p.trim());
    const street = addrParts[0] || '';
    const city = addrParts[1] || '';
    
    // Extract photo URL from image link
    const photoMatch = block.match(/!\[[^\]]*\]\((https:\/\/s3\.amazonaws\.com\/mlsphotos[^)]+)\)/);
    const photoUrl = photoMatch ? photoMatch[1] : '';
    
    // Extract listing details
    const idMatch = block.match(/Listing ID(\d+)/);
    const priceMatch = block.match(/Price\$([0-9,]+)/);
    const statusMatch = block.match(/Status(Active|Pending|Sold)/);
    const bedsMatch = block.match(/Bedrooms(\d+)/);
    const bathsMatch = block.match(/Total Baths(\d+)/);
    const sqftMatch = block.match(/SqFt\s*\n([\d,]+)/);
    const acresMatch = block.match(/Acres\s*\n([\d.]+)/);
    const agentMatch = block.match(/Listing courtesy of (\w+) with Sundgren Realty/);
    
    // Extract description (text between subdivision and the photo gallery link)
    const descMatch = block.match(/Subdivision[^\n]+\n\n([^[]{20,400})/);
    
    listings.push({
      address: `${street}, ${city}, KS ${zip}`,
      street,
      city,
      zip,
      listingId: listingId || (idMatch ? idMatch[1] : ''),
      detailUrl,
      photoUrl,
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

// Load all scraped page files
const dataDir = './data/scraped-pages';
if (!fs.existsSync(dataDir)) {
  console.log('No scraped pages found. Run firecrawl scrapes first.');
  process.exit(0);
}

const allListings = [];
const seenIds = new Set();

const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.txt')).sort();
console.log(`Processing ${files.length} page files...`);

for (const file of files) {
  const content = fs.readFileSync(`${dataDir}/${file}`, 'utf8');
  const listings = parseListings(content);
  
  for (const l of listings) {
    if (!seenIds.has(l.listingId)) {
      seenIds.add(l.listingId);
      allListings.push(l);
    }
  }
  
  console.log(`${file}: found ${listings.length} Sundgren listings`);
}

console.log(`\nTotal unique Sundgren listings: ${allListings.length}`);
fs.writeFileSync('./data/sundgren-listings-full.json', JSON.stringify(allListings, null, 2));
console.log('Saved to data/sundgren-listings-full.json');
