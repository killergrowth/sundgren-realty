import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'generate-auctions.mjs');
let content = fs.readFileSync(filePath, 'utf8');

// ── 1. Add CSS for calendar buttons to the sundgren.css ──────────────────────
const cssPath = path.join(__dirname, 'css', 'sundgren.css');
let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('.cal-btn')) {
  css += `

/* ── Add to Calendar buttons ──────────────────────────────────────── */
.cal-buttons { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 16px; }
.cal-buttons > p { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-light); margin: 0 0 10px; display: flex; align-items: center; gap: 6px; }
.cal-buttons > p i { color: var(--yellow-dark); }
.cal-btn-row { display: flex; flex-wrap: wrap; gap: 8px; }
.cal-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 7px 13px; border-radius: 6px; text-decoration: none; transition: opacity .15s; border: 1px solid transparent; }
.cal-btn:hover { opacity: .82; }
.cal-btn--google  { background: #fff; border-color: #dadce0; color: #3c4043; }
.cal-btn--outlook { background: #0078d4; color: #fff; border-color: #0078d4; }
.cal-btn--ics     { background: var(--dark); color: #fff; border-color: var(--dark); }
`;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('CSS written to sundgren.css');
} else {
  console.log('CSS already present, skipping');
}

// ── 2. Add helper functions before renderInfoCard ─────────────────────────────
const calHelper = `
// === Calendar Helpers ====================================================
function toIcsDate(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toISOString().replace(/[-:]/g, '').replace(/\\.\\d{3}/, '');
}

function renderCalendarButtons(auction) {
  if (!auction.starts_at) return '';

  const titleEnc  = encodeURIComponent(auction.name || 'Sundgren Auction');
  const locationE = encodeURIComponent(auction.location || 'sundgrenrealty.com');
  const descE     = encodeURIComponent('Sundgren Realty & Auction — Register to bid at sundgrenrealty.com/auctions/');

  const startIcs = toIcsDate(auction.starts_at);
  const endIcs   = auction.scheduled_end_time ? toIcsDate(auction.scheduled_end_time) : startIcs;

  const startGcal = new Date(auction.starts_at).toISOString().replace(/[-:]/g,'').replace(/\\.\\d{3}/,'');
  const endGcal   = auction.scheduled_end_time
    ? new Date(auction.scheduled_end_time).toISOString().replace(/[-:]/g,'').replace(/\\.\\d{3}/,'')
    : startGcal;

  const gcalUrl    = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + '&text=' + titleEnc
    + '&dates=' + startGcal + '/' + endGcal
    + '&details=' + descE
    + '&location=' + locationE;

  const outlookUrl = 'https://outlook.live.com/calendar/0/deeplink/compose'
    + '?subject=' + titleEnc
    + '&startdt=' + encodeURIComponent(auction.starts_at)
    + '&enddt='   + encodeURIComponent(auction.scheduled_end_time || auction.starts_at)
    + '&body='    + descE
    + '&location='+ locationE;

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sundgren Realty//Auction//EN',
    'BEGIN:VEVENT',
    'DTSTART:' + startIcs,
    'DTEND:'   + endIcs,
    'SUMMARY:' + (auction.name || 'Sundgren Auction'),
    'DESCRIPTION:Register to bid at sundgrenrealty.com/auctions/',
    'LOCATION:' + (auction.location || 'sundgrenrealty.com'),
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\\r\\n');

  const icsEncoded = encodeURIComponent(icsLines);

  return [
    '<div class="cal-buttons">',
    '  <p><i class="fas fa-calendar-plus"></i>Add to Calendar</p>',
    '  <div class="cal-btn-row">',
    '    <a href="' + gcalUrl + '" target="_blank" rel="noopener" class="cal-btn cal-btn--google">',
    '      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>',
    '      Google',
    '    </a>',
    '    <a href="' + outlookUrl + '" target="_blank" rel="noopener" class="cal-btn cal-btn--outlook">',
    '      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 14a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>',
    '      Outlook',
    '    </a>',
    '    <a href="data:text/calendar;charset=utf-8,' + icsEncoded + '" download="sundgren-auction.ics" class="cal-btn cal-btn--ics">',
    '      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 2v1H7V2H5v1H4a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1V2h-2zm3 7H4V5h1v1h2V5h10v1h2V5h1v4zM6 13h2v2H6zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>',
    '      Apple / iCal',
    '    </a>',
    '  </div>',
    '</div>'
  ].join('\\n');
}

`;

const insertBefore = content.indexOf('function renderInfoCard(');
if (insertBefore === -1) { console.error('ERROR: renderInfoCard not found'); process.exit(1); }
content = content.slice(0, insertBefore) + calHelper + content.slice(insertBefore);

// ── 3. Inject into renderInfoCard after ${cta} ────────────────────────────────
const oldCta = '${cta}\n${docsHtml}';
const newCta  = '${cta}\n${active ? renderCalendarButtons(auction) : \'\'}\n${docsHtml}';
if (!content.includes(oldCta)) { console.error('ERROR: cta injection point not found'); process.exit(1); }
content = content.replace(oldCta, newCta);

fs.writeFileSync(filePath, content, 'utf8');
console.log('generate-auctions.mjs updated successfully');
