import https from 'https';

function fetchAuction(id) {
  return new Promise((resolve, reject) => {
    https.get(`https://sundgrenrealty.bidwrangler.com/api/auctions/${id}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    });
  });
}

const ids = [165183, 166314, 165648];
for (const id of ids) {
  const json = await fetchAuction(id);
  const item = json.items && json.items[0];
  const docs = item ? (item.documents || []) : [];
  const desc = (json.description || '').replace(/<[^>]+>/g, '');
  const terms = (json.terms && json.terms.legalese ? json.terms.legalese : '').replace(/<[^>]+>/g, '');
  const combined = desc + ' ' + terms;

  const taxMatch = combined.match(/REAL ESTATE TAXES[^$\n]*\$([0-9,\.]+)/i);
  const earnestMatch = combined.match(/[Ee]arnest money[^$]*\$([0-9,]+)/);

  console.log(`--- Auction ${id} ---`);
  console.log('Docs:', docs.map(d => d.file_name).join(', ') || 'none');
  console.log('Taxes:', taxMatch ? taxMatch[1] : 'not found');
  console.log('Earnest:', earnestMatch ? earnestMatch[1] : 'not found');
  console.log('');
}
