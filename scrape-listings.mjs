/**
 * scrape-listings.mjs
 * Scrapes residential + land IDX pages from realestate.sundgren.com
 * and outputs a JSON array of Sundgren-only listings.
 *
 * Usage: node scrape-listings.mjs
 */

import { chromium } from 'playwright';
import fs from 'fs';

const RESIDENTIAL_URL = 'https://realestate.sundgren.com/i/residential-property';
const LAND_URL = 'https://realestate.sundgren.com/idx/search/?pt=ld&per_page=100&a_propStatus[]=Active';

async function scrapeListingPage(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const listings = await page.evaluate(() => {
    const results = [];
    // Each listing block has a "Listing courtesy of X with Sundgren Realty"
    const allText = document.body.innerText;
    const items = document.querySelectorAll('a[href*="realestate.sundgren.com/idx/details"]');
    
    // Fallback: grab from links
    document.querySelectorAll('a').forEach(a => {
      if (a.href && a.href.includes('/idx/details/')) {
        const parent = a.closest('div') || a.parentElement;
        const text = parent ? parent.innerText : '';
        if (text.includes('Sundgren Realty') && text.includes('Listing courtesy')) {
          results.push({ href: a.href, text: text.trim() });
        }
      }
    });
    return results;
  });

  return listings;
}

async function scrapePageContent(page) {
  return await page.evaluate(() => {
    const results = [];
    
    // Find all listing blocks — each has an address link and listing info
    const addressLinks = Array.from(document.querySelectorAll('a')).filter(a => 
      a.href && a.href.includes('/idx/details/')
    );
    
    addressLinks.forEach(link => {
      // Walk up to find the listing block container
      let container = link.parentElement;
      for (let i = 0; i < 5; i++) {
        if (container && container.innerText && container.innerText.includes('Listing courtesy')) break;
        container = container ? container.parentElement : null;
      }
      
      if (!container) return;
      const blockText = container.innerText || '';
      
      // Only Sundgren's own
      if (!blockText.includes('Sundgren Realty')) return;
      
      // Parse fields
      const address = link.innerText.trim();
      const idMatch = blockText.match(/Listing ID[:\s]+(\d+)/);
      const priceMatch = blockText.match(/Price:\s*\$([0-9,]+)/);
      const statusMatch = blockText.match(/Status[:\s]*(Active|Pending|Sold)/i);
      const bedsMatch = blockText.match(/Bedrooms[:\s]*(\d+)/);
      const bathsMatch = blockText.match(/(?:Total\s+)?Baths[:\s]*(\d+)/);
      const sqftMatch = blockText.match(/SqFt[:\s]*([\d,]+)/);
      const acresMatch = blockText.match(/Acres[:\s]*([\d.]+)/);
      const agentMatch = blockText.match(/Listing courtesy of (\w+) with Sundgren Realty/);
      const descMatch = blockText.match(/Subdivision[^\n]*\n([\s\S]{30,300}?)(?=Photo|Add to|View Details)/);
      
      results.push({
        address,
        url: link.href,
        listingId: idMatch ? idMatch[1] : '',
        price: priceMatch ? priceMatch[1].replace(/,/g, '') : '',
        status: statusMatch ? statusMatch[1] : 'Active',
        beds: bedsMatch ? bedsMatch[1] : '',
        baths: bathsMatch ? bathsMatch[1] : '',
        sqft: sqftMatch ? sqftMatch[1].replace(/,/g, '') : '',
        acres: acresMatch ? acresMatch[1] : '',
        agent: agentMatch ? agentMatch[1] : '',
        description: descMatch ? descMatch[1].trim() : '',
      });
    });
    
    return results;
  });
}

async function getTotalPages(page) {
  return await page.evaluate(() => {
    const pageEl = document.querySelector('a[class*="page"], button[class*="page"]');
    const text = document.body.innerText;
    const match = text.match(/1\s*\/\s*(\d+)/);
    return match ? parseInt(match[1]) : 1;
  });
}

async function navigateToPage(page, pageNum) {
  await page.evaluate((n) => {
    const sel = document.querySelector('select.page-selector, select[name*="page"], combobox, select');
    if (sel) {
      sel.value = n;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, pageNum);
  await page.waitForTimeout(3000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const allListings = [];

  // Scrape residential
  console.log('Loading residential page...');
  await page.goto(RESIDENTIAL_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const totalPages = await getTotalPages(page);
  console.log(`Total residential pages: ${totalPages}`);

  for (let p = 1; p <= totalPages; p++) {
    console.log(`Scraping residential page ${p}/${totalPages}...`);
    if (p > 1) {
      // Click next
      const nextBtn = await page.$('button:has-text(">>")');
      if (nextBtn) { await nextBtn.click(); await page.waitForTimeout(3000); }
      else break;
    }
    const listings = await scrapePageContent(page);
    console.log(`  Found ${listings.length} Sundgren listings on page ${p}`);
    allListings.push(...listings);
  }

  // Scrape land
  console.log('\nLoading land listings...');
  await page.goto(LAND_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const landListings = await scrapePageContent(page);
  console.log(`Found ${landListings.length} Sundgren land listings`);
  allListings.push(...landListings);

  await browser.close();

  // Deduplicate by listingId
  const seen = new Set();
  const deduped = allListings.filter(l => {
    if (seen.has(l.listingId)) return false;
    seen.add(l.listingId);
    return true;
  });

  console.log(`\nTotal unique Sundgren listings: ${deduped.length}`);
  fs.writeFileSync('./data/sundgren-listings.json', JSON.stringify(deduped, null, 2));
  console.log('Saved to data/sundgren-listings.json');
})();
