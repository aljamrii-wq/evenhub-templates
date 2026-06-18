// Post-build: add .js extensions to relative imports for Node ESM compatibility
import { readFileSync, writeFileSync } from 'fs';
import { readdirSync } from 'fs';
import { join } from 'path';

const distDir = 'dist';
for (const file of readdirSync(distDir)) {
  if (!file.endsWith('.js')) continue;
  const path = join(distDir, file);
  let content = readFileSync(path, 'utf8');
  // Add .js to extensionless relative imports
  content = content.replace(/from\s+'\.\/([^']+)'(?!\.)/g, "from './$1.js'");
  writeFileSync(path, content, 'utf8');
  console.log(`Fixed: ${file}`);
}
