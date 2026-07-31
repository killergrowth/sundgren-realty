/**
 * download-live-images.mjs
 * Downloads images from the live sundgren.com site for reference/reuse on the new build.
 */
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(ROOT, 'images', 'from-live-site');
const AGENTS_DIR = path.join(OUT_DIR, 'agents');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(AGENTS_DIR, { recursive: true });

const IMAGES = [
  // Site-wide
  { url: 'https://sundgren.com/wp-content/uploads/home-land.jpg', dest: path.join(OUT_DIR, 'home-land.jpg') },
  { url: 'https://sundgren-v1784816763.websitepro-cdn.com/wp-content/uploads/2015/03/sundgren-realty-logo.png', dest: path.join(OUT_DIR, 'sundgren-realty-logo.png') },
  { url: 'https://sundgren-v1784816763.websitepro-cdn.com/wp-content/uploads/sundgren-logo-white.png', dest: path.join(OUT_DIR, 'sundgren-logo-white.png') },
  { url: 'https://sundgren.com/wp-content/uploads/sundgren-icon-white.png', dest: path.join(OUT_DIR, 'sundgren-icon-white.png') },
  { url: 'https://sundgren.com/wp-content/uploads/apple-store.png', dest: path.join(OUT_DIR, 'apple-store.png') },
  { url: 'https://sundgren.com/wp-content/uploads/google-play2.png', dest: path.join(OUT_DIR, 'google-play2.png') },
  { url: 'https://sundgren.com/wp-content/uploads/sundgren-auction-app.png', dest: path.join(OUT_DIR, 'sundgren-auction-app.png') },
  // Agent headshots
  { url: 'https://sundgren.com/wp-content/uploads/2020/03/52-scaled.jpg', dest: path.join(AGENTS_DIR, 'agent-52.jpg') },
  { url: 'https://sundgren.com/wp-content/uploads/2020/03/27-scaled.jpg', dest: path.join(AGENTS_DIR, 'agent-27.jpg') },
  { url: 'https://sundgren.com/wp-content/uploads/2020/03/36-scaled.jpg', dest: path.join(AGENTS_DIR, 'agent-36.jpg') },
  { url: 'https://sundgren.com/wp-content/uploads/2020/03/18-scaled.jpg', dest: path.join(AGENTS_DIR, 'agent-18.jpg') },
  { url: 'https://sundgren.com/wp-content/uploads/2020/03/13-scaled.jpg', dest: path.join(AGENTS_DIR, 'agent-13.jpg') },
  { url: 'https://sundgren.com/wp-content/uploads/2020/03/43-scaled.jpg', dest: path.join(AGENTS_DIR, 'agent-43.jpg') },
  { url: 'https://sundgren.com/wp-content/uploads/2020/03/39-scaled.jpg', dest: path.join(AGENTS_DIR, 'agent-39.jpg') },
  { url: 'https://sundgren.com/wp-content/uploads/2020/03/44-scaled.jpg', dest: path.join(AGENTS_DIR, 'agent-44.jpg') },
  { url: 'https://sundgren.com/wp-content/uploads/2023/09/thumbnail_69-scaled.jpg', dest: path.join(AGENTS_DIR, 'agent-thumbnail_69.jpg') },
  { url: 'https://sundgren.com/wp-content/uploads/2024/05/Yousef.jpeg', dest: path.join(AGENTS_DIR, 'agent-Yousef.jpg') },
  { url: 'https://sundgren.com/wp-content/uploads/2021/02/Head-shots-new-8.jpg', dest: path.join(AGENTS_DIR, 'agent-Head-shots-new-8.jpg') },
  { url: 'https://sundgren.com/wp-content/uploads/2025/07/Erin-Headshot-1.jpg', dest: path.join(AGENTS_DIR, 'agent-Erin-Headshot-1.jpg') },
  { url: 'https://sundgren.com/wp-content/uploads/2023/08/thumbnail_66-scaled.jpg', dest: path.join(AGENTS_DIR, 'agent-thumbnail_66.jpg') },
  { url: 'https://sundgren.com/wp-content/uploads/susan1-1-e1440598399551.jpg', dest: path.join(AGENTS_DIR, 'agent-susan.jpg') },
  { url: 'https://sundgren.com/wp-content/uploads/2024/03/Nordman-Tyler-e1779368290943.jpg', dest: path.join(AGENTS_DIR, 'agent-Nordman-Tyler.jpg') },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

let ok = 0, fail = 0;
for (const img of IMAGES) {
  const name = path.basename(img.dest);
  try {
    await download(img.url, img.dest);
    const size = fs.statSync(img.dest).size;
    console.log(`  OK: ${name} (${size} bytes)`);
    ok++;
  } catch (e) {
    console.log(`  FAIL: ${name} — ${e.message}`);
    fail++;
  }
}

console.log(`\nDone. ${ok} downloaded, ${fail} failed.`);
console.log(`Output: ${OUT_DIR}`);
