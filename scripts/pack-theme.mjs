import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const manifestPath = path.join(rootDir, 'komari-theme.json');
const distDir = path.join(rootDir, 'dist');
const releaseDir = path.join(rootDir, 'release');

function fail(msg) {
  console.error(`[pack-theme] ERROR: ${msg}`);
  process.exit(1);
}

// 1. Validate komari-theme.json
if (!fs.existsSync(manifestPath)) {
  fail('Missing komari-theme.json at project root.');
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (err) {
  fail(`Invalid JSON in komari-theme.json: ${err.message}`);
}

for (const field of ['name', 'short', 'version', 'author', 'preview']) {
  if (!manifest[field] || typeof manifest[field] !== 'string') {
    fail(`komari-theme.json missing required string field "${field}".`);
  }
}

if (!/^[a-z0-9-]+$/.test(manifest.short)) {
  fail(`komari-theme.json "short" must be kebab-case alphanumeric (got "${manifest.short}").`);
}

// 2. Ensure preview.png exists (generate if missing)
const previewFile = path.join(rootDir, manifest.preview);
if (!fs.existsSync(previewFile)) {
  const genScript = path.join(__dirname, 'generate-preview.mjs');
  if (fs.existsSync(genScript)) {
    console.log(`[pack-theme] Generating ${manifest.preview}...`);
    execFileSync(process.execPath, [genScript], { cwd: rootDir, stdio: 'inherit' });
  }
}
if (!fs.existsSync(previewFile)) {
  fail(`Missing preview image "${manifest.preview}" referenced by komari-theme.json.`);
}

// 3. Validate dist/ build output
const distIndex = path.join(distDir, 'index.html');
if (!fs.existsSync(distIndex)) {
  fail('Missing dist/index.html. Run `npm run build` first.');
}

const indexHtml = fs.readFileSync(distIndex, 'utf8');
if (indexHtml.includes('src="/assets/') || indexHtml.includes('href="/assets/')) {
  console.warn('[pack-theme] WARN: dist/index.html contains root-relative /assets/ paths; Komari themes should use relative ./assets/ paths.');
}

// 4. Create ZIP archive in release/
fs.mkdirSync(releaseDir, { recursive: true });
const zipName = `${manifest.short}-v${manifest.version}.zip`;
const zipPath = path.join(releaseDir, zipName);
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

execFileSync(
  'zip',
  ['-r', '-q', zipPath, 'komari-theme.json', manifest.preview, 'dist'],
  { cwd: rootDir, stdio: 'inherit' },
);

const stat = fs.statSync(zipPath);
console.log(`[pack-theme] Packaged Komari theme: ${path.relative(rootDir, zipPath)} (${(stat.size / 1024).toFixed(1)} KB)`);
