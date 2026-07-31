function parseDescription(raw) {
  // 1. Strip HTML tags
  let text = String(raw || '').replace(/<[^>]+>/g, ' ');
  // 2. Fix encoding artifacts
  text = text
    .replace(/\u00c2\u00a0/g, ' ')
    .replace(/\u00c2/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/A,A[\u00b0\u00a0°\s]/g, ' ')
    .replace(/\u00c2 /g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();

  const YELLOW = 'var(--yellow)';

  // 3. CSS (injected once)
  const css = `<style>
    .desc-section { margin-bottom:20px; padding:16px 20px; background:var(--bg-light); border-radius:8px; border-left:4px solid var(--yellow); }
    .desc-section:last-child { margin-bottom:0; }
    .desc-section-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--dark); margin:0 0 8px; display:flex; align-items:center; gap:8px; }
    .desc-section-title i { color:var(--yellow-dark); font-size:13px; }
    .desc-section p, .desc-section li { font-size:14px; line-height:1.75; color:var(--text); margin:0; }
    .desc-section ul { margin:0; padding-left:0; list-style:none; display:flex; flex-direction:column; gap:4px; }
    .desc-section ul li { display:flex; align-items:flex-start; gap:8px; }
    .desc-section ul li::before { content:''; display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--yellow); flex-shrink:0; margin-top:6px; }
    .lot-table { width:100%; border-collapse:collapse; font-size:14px; }
    .lot-table th { background:var(--dark); color:#fff; padding:8px 12px; text-align:left; font-size:12px; text-transform:uppercase; letter-spacing:.05em; }
    .lot-table td { padding:8px 12px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:top; }
    .lot-table tr:last-child td { border-bottom:none; }
    .lot-table tr:nth-child(even) td { background:#f9f9f9; }
    .desc-key-facts { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; margin-bottom:20px; }
    .desc-key-fact { background:var(--bg-light); border-radius:8px; padding:14px 16px; display:flex; flex-direction:column; gap:4px; border-left:4px solid var(--yellow); }
    .desc-key-fact-label { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-light); font-weight:600; }
    .desc-key-fact-value { font-size:14px; color:var(--dark); font-weight:600; line-height:1.4; }
  </style>`;

  // 4. Known named section keywords (split on these)
  const sectionKeys = ['PICKUP','TERMS','LOCATION','NOTE','NOTES','PREVIEW','REMOVAL','PAYMENT','BIDDING','SHIPPING','INSPECTION','DIRECTIONS'];
  const sectionRegex = new RegExp('(' + sectionKeys.join('|') + '):', 'g');

  // 5. Pre-section inline key patterns to extract as key-fact cards
  const inlineKeys = [
    { key: 'Auction Date', icon: 'fa-calendar-alt', label: 'Auction Date' },
    { key: 'Auction Location', icon: 'fa-map-marker-alt', label: 'Location' },
    { key: 'OPEN HOUSE(?:/Item Preview)?', icon: 'fa-eye', label: 'Open House / Preview' },
    { key: 'Item Preview', icon: 'fa-eye', label: 'Item Preview' },
    { key: 'Preview', icon: 'fa-eye', label: 'Preview' },
    { key: 'DIRECTIONS', icon: 'fa-road', label: 'Directions' },
  ];

  const iconMap = {
    PICKUP:'fa-box-open', REMOVAL:'fa-box-open',
    TERMS:'fa-file-contract',
    LOCATION:'fa-map-marker-alt',
    PAYMENT:'fa-credit-card',
    PREVIEW:'fa-eye', INSPECTION:'fa-eye',
    BIDDING:'fa-gavel',
    SHIPPING:'fa-truck',
    NOTE:'fa-info-circle', NOTES:'fa-info-circle',
    DIRECTIONS:'fa-road',
  };

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // 6. Split text on named section keywords first
  const parts = text.split(sectionRegex);
  // parts[0] = pre-section text, then alternating [KEYWORD, body, KEYWORD, body, ...]

  let preText = parts[0].trim();
  const namedSections = [];
  for (let j = 1; j < parts.length; j += 2) {
    namedSections.push({ title: parts[j], body: (parts[j+1] || '').trim() });
  }

  // 7. Parse pre-section text into key-fact cards + bullet item list
  let keyFacts = [];
  let bulletItems = [];
  let remainingPre = preText;

  // Extract inline key:value pairs
  // Pattern: "Key: value" where value runs until the next known key or a bullet separator
  const allKeyPattern = new RegExp(
    '(?:Auction Date|Auction Location|OPEN HOUSE(?:/Item Preview)?|Item Preview|Preview|DIRECTIONS)\\s*:?\\s*([^•\\n]+?)(?=(?:Auction Date|Auction Location|OPEN HOUSE|Item Preview|Preview|DIRECTIONS|$|•))',
    'gi'
  );

  let km;
  const extractedRanges = [];
  while ((km = allKeyPattern.exec(preText)) !== null) {
    const fullMatch = km[0];
    const value = km[1].trim().replace(/\s+/g, ' ');
    if (!value) continue;

    // Find which key matched
    const keyFound = inlineKeys.find(ik => new RegExp('^' + ik.key, 'i').test(fullMatch));
    if (keyFound) {
      keyFacts.push({ icon: keyFound.icon, label: keyFound.label, value });
      extractedRanges.push([km.index, km.index + fullMatch.length]);
    }
  }

  // Remove extracted ranges from preText to get remainder
  let cleaned = preText;
  // Work backwards so indices stay valid
  for (let i = extractedRanges.length - 1; i >= 0; i--) {
    cleaned = cleaned.substring(0, extractedRanges[i][0]) + ' ' + cleaned.substring(extractedRanges[i][1]);
  }
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  // Extract bullet items (• Item • Item pattern)
  const bulletParts = cleaned.split(/\s*[•·]\s*/).map(s => s.trim()).filter(s => s.length > 2 && !/^\*/.test(s));
  // Anything that looks like a structured item goes to bullets, rest is freeText
  const freeParts = [];
  for (const part of bulletParts) {
    // If it's a short label (looks like a lot item: all caps, <50 chars), treat as bullet
    if (/^[A-Z0-9 \-/&,()'"\.]+$/.test(part) && part.length < 80) {
      bulletItems.push(part);
    } else if (part.length > 10) {
      freeParts.push(part);
    }
  }

  // 8. Build HTML
  let html = css;

  // Key facts grid (if we have any)
  if (keyFacts.length > 0) {
    html += '\n<div class="desc-key-facts">';
    for (const kf of keyFacts) {
      html += `\n  <div class="desc-key-fact">
    <span class="desc-key-fact-label"><i class="fas ${esc(kf.icon)}" style="margin-right:5px;color:var(--yellow-dark);"></i>${esc(kf.label)}</span>
    <span class="desc-key-fact-value">${esc(kf.value)}</span>
  </div>`;
    }
    html += '\n</div>';
  }

  // Bullet item list (featured items)
  if (bulletItems.length > 0) {
    html += `\n<div class="desc-section">
  <h3 class="desc-section-title"><i class="fas fa-gavel"></i> Featured Items</h3>
  <ul>
    ${bulletItems.map(b => `<li>${esc(b)}</li>`).join('\n    ')}
  </ul>
</div>`;
  }

  // Free text remainder
  for (const fp of freeParts) {
    if (fp.length > 15) {
      html += `\n<p style="margin-bottom:14px;font-size:14px;line-height:1.75;color:var(--text);">${esc(fp)}</p>`;
    }
  }

  // 9. Named sections (PICKUP, TERMS, etc.)
  for (const sec of namedSections) {
    // Check for lot table in body
    const lotMatch = sec.body.match(/Lot\s*#?\s*Name\s+(.+)/i);
    let bodyText = sec.body;
    let lotHtml = '';

    if (lotMatch) {
      bodyText = sec.body.substring(0, sec.body.search(/Lot\s*#?\s*Name/i)).trim();
      const lotRaw = lotMatch[1];
      const lotItems = [];
      const lotItemRegex = /(\d+)\s+(.+?)(?=\s+\d+\s+|$)/g;
      let m;
      while ((m = lotItemRegex.exec(lotRaw)) !== null) {
        lotItems.push({ num: m[1], name: m[2].trim() });
      }
      if (lotItems.length > 0) {
        lotHtml = `\n<div class="lot-table-wrap" style="margin-top:16px;">
  <h3 style="font-size:15px;font-weight:700;color:var(--dark);margin:0 0 10px;display:flex;align-items:center;gap:8px;">
    <i class="fas fa-list" style="color:var(--yellow-dark);"></i> Lot List
  </h3>
  <div style="overflow-x:auto;">
  <table class="lot-table">
    <thead><tr><th style="width:50px;">#</th><th>Item</th></tr></thead>
    <tbody>
      ${lotItems.map(l => `<tr><td style="font-weight:700;color:var(--dark);">${esc(l.num)}</td><td>${esc(l.name)}</td></tr>`).join('\n      ')}
    </tbody>
  </table>
  </div>
</div>`;
      }
    }

    const icon = iconMap[sec.title] || 'fa-info-circle';
    const titleDisplay = sec.title.charAt(0) + sec.title.slice(1).toLowerCase();
    html += `\n<div class="desc-section">
  <h3 class="desc-section-title"><i class="fas ${icon}"></i> ${esc(titleDisplay)}</h3>
  ${bodyText ? `<p>${esc(bodyText)}</p>` : ''}${lotHtml}
</div>`;
  }

  return html || '<p>Contact Sundgren Realty for more information about this auction.</p>';
}

