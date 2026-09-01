import fs from 'fs';
import { execSync } from 'child_process';

const pages = [
  'dist/listings/index.html',
  'dist/listings/residential/index.html',
  'dist/listings/land/index.html',
];

// need to build first — just validate source files
const sources = [
  'listings/index.html',
  'listings/residential/index.html',
  'listings/land/index.html',
];

for (const src of sources) {
  const s = fs.readFileSync(src, 'utf8');
  const scriptStart = s.lastIndexOf('<script>') + '<script>'.length;
  const scriptEnd   = s.lastIndexOf('</script>');
  const script = s.substring(scriptStart, scriptEnd);
  fs.writeFileSync('_tmp_check.js', script, 'utf8');
  try {
    execSync('node --check _tmp_check.js', { stdio: 'pipe' });
    console.log('✅', src);
  } catch(e) {
    console.error('❌', src);
    console.error(e.stderr.toString().substring(0, 400));
  }
}
fs.unlinkSync('_tmp_check.js');
