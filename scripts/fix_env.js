import fs from 'fs';

const path = '.env';
if (!fs.existsSync(path)) {
  console.error('.env not found');
  process.exit(1);
}

const content = fs.readFileSync(path, 'utf8');
const lines = content.split(/\r?\n/);
let out = [];
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  if (line.startsWith('DATABASE_URL=')) {
    // Strip surrounding quotes
    line = line.replace(/^(DATABASE_URL=)["'](.*)["']\s*$/, (m, p1, p2) => p1 + p2);
    // If next line looks like a continued URL fragment (no '=' sign and not a comment), merge it
    const fragments = [line];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (next.trim() === '') break;
      if (/^[A-Za-z0-9_]+\s*=/.test(next)) break; // next key=value, stop
      if (/^#/.test(next)) break; // comment, stop
      fragments.push(next.trim());
      j++;
    }
    if (fragments.length > 1) {
      // Merge and normalize
      let merged = fragments.join('');
      merged = merged.replace(/^(DATABASE_URL=)["']?(.*?)["']?\s*$/, (m, p1, p2) => p1 + p2);
      out.push(merged);
      i = j - 1; // advance past consumed lines
      continue;
    } else {
      out.push(line);
      continue;
    }
  }
  out.push(line);
}

fs.writeFileSync(path, out.join('\n'));
console.log('Normalized .env DATABASE_URL');
