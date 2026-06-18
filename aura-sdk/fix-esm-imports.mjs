// Post-build: add explicit file extensions to relative imports so the emitted
// ESM resolves under Node's ESM loader (and any strict bundler). TypeScript
// leaves specifiers as written, so `./foo` and `./bar/` need `.js` / `/index.js`.
//
// Handles: single and double quotes; `import ... from`, `export ... from`, and
// bare `import './x'`; nested directories; and directory specifiers (→ index.js).
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';

const distDir = 'dist';

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (entry.endsWith('.js')) out.push(p);
  }
  return out;
}

function resolveSpecifier(filePath, spec) {
  // Already has an extension we recognise — leave it.
  if (/\.(js|mjs|cjs|json)$/.test(spec)) return spec;
  const base = resolve(dirname(filePath), spec);
  if (existsSync(base) && statSync(base).isDirectory()) return `${spec}/index.js`;
  return `${spec}.js`;
}

const SPECIFIER_RE = /(from\s*|import\s*)(['"])(\.\.?\/[^'"]*)\2/g;

let fixedCount = 0;
for (const file of walk(distDir)) {
  const content = readFileSync(file, 'utf8');
  const next = content.replace(SPECIFIER_RE, (full, kw, quote, spec) => {
    const resolved = resolveSpecifier(file, spec);
    return `${kw}${quote}${resolved}${quote}`;
  });
  if (next !== content) {
    writeFileSync(file, next, 'utf8');
    fixedCount += 1;
  }
}
console.log(`fix-esm-imports: rewrote relative specifiers in ${fixedCount} file(s).`);
