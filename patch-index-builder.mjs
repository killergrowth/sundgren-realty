import fs from 'fs';
let s = fs.readFileSync('generate-repliers-listings.mjs', 'utf8');
s = s.replace(/\r\n/g, '\n');

const oldPush = `      status: listing.status,
      image: listing.images && listing.images.length ? imgUrl(listing.images[0]) : '',
      style: listing.details.style || '',
    });`;

const newPush = `      status: listing.status,
      lastStatus: listing.lastStatus || '',
      image: listing.images && listing.images.length ? imgUrl(listing.images[0]) : '',
      style: listing.details.style || '',
      isSundgren: listing._isSundgren || false,
      agentName:  listing._agentName  || '',
      agentPhone: listing._agentPhone || '',
      agentEmail: listing._agentEmail || '',
    });`;

if (s.includes(oldPush)) {
  s = s.replace(oldPush, newPush);
  console.log('✅ Index builder patched — isSundgren + agent fields added');
} else {
  console.error('❌ Could not find push block');
  process.exit(1);
}

fs.writeFileSync('generate-repliers-listings.mjs', s, 'utf8');
