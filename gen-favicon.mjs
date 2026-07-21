import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'images');

// SVG favicon — sun emoji, supported by all modern browsers
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <text y=".9em" font-size="90" font-family="Segoe UI Emoji,Apple Color Emoji,Noto Color Emoji,sans-serif">&#9728;&#65039;</text>
</svg>`;

fs.writeFileSync(path.join(outDir, 'favicon.svg'), svg.trim(), 'utf8');
console.log('favicon.svg written');

// Also write apple-touch-icon as an SVG (rename-safe)
const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">
  <rect width="180" height="180" rx="40" fill="#162040"/>
  <text x="90" y="140" font-size="120" text-anchor="middle" font-family="Segoe UI Emoji,Apple Color Emoji,Noto Color Emoji,sans-serif">&#9728;&#65039;</text>
</svg>`;
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.svg'), appleSvg.trim(), 'utf8');
console.log('apple-touch-icon.svg written');
