import fs from 'fs';

const file = 'C:/Users/KillerGrowth/.openclaw/workspace/sites/sundgren-realty/generate-auctions.mjs';
let content = fs.readFileSync(file, 'utf8');

// ── 1. Add fetchAuctionDetail + renderDocuments before fetchAllAuctions ──
const fetchAllIdx = content.indexOf('async function fetchAllAuctions()');
const newFunctions = `// ── Auction Detail API (docs + taxes + earnest) ──────────────────────────────
async function fetchAuctionDetail(id) {
  try {
    const res = await fetch(\`\${BW_BASE_URL}/api/auctions/\${id}\`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data.items && data.items[0];
    const docs = (item && item.documents) ? item.documents : [];
    const termsText = (data.terms && data.terms.legalese)
      ? data.terms.legalese.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim()
      : '';
    const descText = (data.description || '').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ');
    const combined = descText + ' ' + termsText;
    const taxMatch     = combined.match(/REAL ESTATE TAXES[^$\\n]*\\$([0-9,\\.]+)/i);
    const earnestMatch = combined.match(/[Ee]arnest money[^$]*\\$([0-9,]+)/);
    return {
      docs,
      taxes:   taxMatch     ? '$' + taxMatch[1]     : null,
      earnest: earnestMatch ? '$' + earnestMatch[1] : null,
    };
  } catch { return null; }
}

// ── Document Links ────────────────────────────────────────────────────────────
function renderDocuments(docs) {
  if (!docs || !docs.length) return '';
  const icons = { pdf: 'fa-file-pdf', doc: 'fa-file-word', docx: 'fa-file-word', xls: 'fa-file-excel', xlsx: 'fa-file-excel' };
  const links = docs.map(d => {
    const ext   = (d.file_name || '').split('.').pop().toLowerCase();
    const icon  = icons[ext] || 'fa-file-alt';
    const label = (d.file_name || 'Document').replace(/[-_]/g, ' ').replace(/\\.[^.]+$/, '');
    return \`<a href="\${esc(d.url)}" target="_blank" rel="noopener" class="doc-link">
          <i class="fas \${icon}"></i>
          <span>\${esc(label)}</span>
          <i class="fas fa-external-link-alt" style="font-size:10px;opacity:.6;margin-left:auto;"></i>
        </a>\`;
  }).join('\\n        ');
  return \`
    <div class="info-card-docs">
        <h4 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:16px 0 10px;color:var(--dark);padding-top:16px;border-top:1px solid var(--border);"><i class="fas fa-folder-open" style="color:var(--yellow-dark);margin-right:7px;"></i>Documents</h4>
        \${links}
    </div>\`;
}

`;

content = content.slice(0, fetchAllIdx) + newFunctions + content.slice(fetchAllIdx);

// ── 2. Update renderInfoCard signature + add financial rows + docs ──
content = content.replace(
  'function renderInfoCard(auction) {\n  const active  = isActive(auction.status);',
  'function renderInfoCard(auction, detail) {\n  const active  = isActive(auction.status);'
);

// Add taxes/earnest/docs vars after the phone line
content = content.replace(
  `  const phone   = auction.coord_phone || '316-321-7112';

  const cta = active`,
  `  const phone   = auction.coord_phone || '316-321-7112';

  const taxes   = detail && detail.taxes   ? detail.taxes   : null;
  const earnest = detail && detail.earnest ? detail.earnest : null;

  const financialRows = [
    taxes   ? \`<li><i class="fas fa-receipt"></i><div><span class="mlabel">Est. Taxes</span>\${esc(taxes)}/yr</div></li>\` : '',
    earnest ? \`<li><i class="fas fa-hand-holding-usd"></i><div><span class="mlabel">Earnest Money</span>\${esc(earnest)}</div></li>\` : '',
  ].filter(Boolean).join('\\n            ');

  const docsHtml = detail && detail.docs && detail.docs.length ? renderDocuments(detail.docs) : '';

  const cta = active`
);

// Add financialRows to the meta-list (before the phone li)
content = content.replace(
  `            \${auction.online_only ? \`<li><i class="fas fa-laptop"></i><div><span class="mlabel">Format</span>Online Only</div></li>\` : ''}
            <li><i class="fas fa-phone"></i>`,
  `            \${auction.online_only ? \`<li><i class="fas fa-laptop"></i><div><span class="mlabel">Format</span>Online Only</div></li>\` : ''}
            \${financialRows}
            <li><i class="fas fa-phone"></i>`
);

// Add docsHtml before closing </div> of info-card
content = content.replace(
  '${cta}\n    </div>`;\n}',
  '${cta}\n${docsHtml}\n    </div>`;\n}'
);

// ── 3. Update renderAuctionPage to pass _detail ──
content = content.replace(
  'const infoCard  = renderInfoCard(auction);',
  'const infoCard  = renderInfoCard(auction, auction._detail || null);'
);

// ── 4. Add detail-fetch loop before "for (const auction of auctions)" ──
content = content.replace(
  '  for (const auction of auctions) {',
  `  // Fetch detail (docs, taxes, earnest) for active auctions only
  const activeAuctions = auctions.filter(a => isActive(a.status));
  console.log(\`  Fetching detail for \${activeAuctions.length} active auctions...\`);
  for (const auction of activeAuctions) {
    const detail = await fetchAuctionDetail(auction.id);
    if (detail) {
      auction._detail = detail;
      if (detail.docs.length) console.log(\`    [\${auction.id}] \${detail.docs.length} doc(s): \${detail.docs.map(d => d.file_name).join(', ')}\`);
      if (detail.taxes)       console.log(\`    [\${auction.id}] taxes: \${detail.taxes}\`);
      if (detail.earnest)     console.log(\`    [\${auction.id}] earnest: \${detail.earnest}\`);
    }
  }

  for (const auction of auctions) {`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched generate-auctions.mjs successfully.');
console.log('Char count:', content.length);
