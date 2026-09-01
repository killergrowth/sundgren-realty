/**
 * fix-nav-active.mjs
 * 1. Fix nav active logic: use exact match for /listings/ so it doesn't highlight "All Listings" on every listings subpage
 * 2. Strip section-title double header from commercial.html
 */
import fs from 'fs';

// ── Fix 1: header.html nav active script ──────────────────────────────────
let header = fs.readFileSync('_partials/header.html', 'utf8');
header = header.replace(/\r\n/g, '\n');

const oldActive = `  // Highlight active nav item
  var path = window.location.pathname;
  document.querySelectorAll('.main-nav li a, .nav-dropdown li a').forEach(function(a) {
    if (a.hostname === window.location.hostname && path !== '/' && a.getAttribute('href') && a.getAttribute('href') !== '/' && path.startsWith(a.getAttribute('href'))) {
      a.classList.add('active');
      // Also mark parent dropdown item active
      var parent = a.closest('.has-dropdown');
      if (parent) parent.querySelector(':scope > a').classList.add('active');
    }
  });`;

const newActive = `  // Highlight active nav item
  var path = window.location.pathname;
  document.querySelectorAll('.main-nav li a, .nav-dropdown li a').forEach(function(a) {
    var href = a.getAttribute('href');
    if (!href || href === '/' || a.hostname !== window.location.hostname) return;
    // Use exact match for index-style paths that are prefixes of others (e.g. /listings/)
    // Use startsWith only for paths that won't greedily match child pages
    var isExact = path === href || path === href.replace(/\\/$/, '') + '/';
    var isPrefix = !isExact && path.startsWith(href) && href !== '/listings/';
    if (isExact || isPrefix) {
      a.classList.add('active');
      var parent = a.closest('.has-dropdown');
      if (parent) parent.querySelector(':scope > a').classList.add('active');
    }
  });`;

if (header.includes(oldActive)) {
  header = header.replace(oldActive, newActive);
  console.log('✅ Nav active script fixed');
} else {
  console.error('❌ Could not find nav active block — check header.html');
  process.exit(1);
}

fs.writeFileSync('_partials/header.html', header, 'utf8');

// ── Fix 2: commercial.html — strip section-title block, add plain subtitle ─
let commercial = fs.readFileSync('commercial.html', 'utf8');
commercial = commercial.replace(/\r\n/g, '\n');

const oldSectionTitle = `      <div class="section-title">
        <span class="eyebrow">Agent Listings</span>
        <h2>Sundgren Commercial Listings</h2>
        <hr class="divider">
        <p>Active commercial properties listed directly by Sundgren Realty agents in South Central Kansas.</p>
      </div>`;

const newSubtitle = `      <p style="font-size:15px;color:var(--text-light);margin-bottom:24px;">Active commercial properties listed directly by Sundgren Realty agents in South Central Kansas.</p>`;

if (commercial.includes(oldSectionTitle)) {
  commercial = commercial.replace(oldSectionTitle, newSubtitle);
  console.log('✅ Commercial section-title removed');
} else {
  // Try a looser match
  const idx = commercial.indexOf('section-title');
  console.error('❌ Could not find exact section-title block. idx:', idx);
  if (idx >= 0) console.log(commercial.substring(idx - 20, idx + 300));
  process.exit(1);
}

fs.writeFileSync('commercial.html', commercial, 'utf8');
console.log('Both fixes applied.');
