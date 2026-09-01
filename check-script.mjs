import fs from 'fs';
const s = fs.readFileSync('dist/listings/land/index.html', 'utf8');

// Get the full inline script block
const scriptStart = s.lastIndexOf('<script>');
const scriptEnd   = s.indexOf('</script>', scriptStart);
const script = s.substring(scriptStart, scriptEnd + 9);

// Check for the li builder — this is where the bug likely is
const liIdx = s.indexOf("return '<li data-value=");
console.log('li builder at:', liIdx);
console.log(s.substring(liIdx - 50, liIdx + 200));

// Check for any obvious syntax errors -- look for the esc() call in the li builder
const escCallIdx = s.indexOf("esc(m)", liIdx);
console.log('\nesc(m) call at:', escCallIdx);
console.log(s.substring(escCallIdx - 20, escCallIdx + 80));

// Check the applyFilters function specifically
const applyIdx = s.indexOf('function applyFilters');
console.log('\napplyFilters:', s.substring(applyIdx, applyIdx + 400));

// Check pills event listener
const pillsIdx = s.indexOf('pills.forEach');
console.log('\npills.forEach:', s.substring(pillsIdx, pillsIdx + 200));

// Check if clearFilters is defined (used in onclick on the no-results link)
console.log('\nclearFilters defined:', s.includes('window.clearFilters'));
