const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js?id=G-ZT6MPW5MNG';
const GENERATOR_PATH = path.join(ROOT, 'src', 'generate_dic_html.js');

function walkHtml(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkHtml(full, files);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

function analyticsTagFor(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  return rel.startsWith('mahler-search-app/')
    ? '<script src="js/analytics.js"></script>'
    : '<script src="mahler-search-app/js/analytics.js"></script>';
}

function removeAnalyticsTags(text) {
  return text.replace(
    /^[ \t]*<script\s+src=["'](?:\/gaswebapp-manual\/mahler-search-app\/js\/analytics\.js|mahler-search-app\/js\/analytics\.js|js\/analytics\.js)["']><\/script>[ \t]*\r?\n/gm,
    ''
  );
}

function patchHtml(file) {
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes(GTAG_SRC)) return false;

  const tag = analyticsTagFor(file);
  text = removeAnalyticsTags(text);

  const gtagLine = new RegExp(
    `(^[ \\t]*<script(?:\\s+async)?\\s+src=["']${GTAG_SRC.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}["']><\\/script>[ \\t]*$)`,
    'm'
  );
  if (!gtagLine.test(text)) {
    throw new Error(`Google tag script line not found in ${path.relative(ROOT, file)}`);
  }

  text = text.replace(gtagLine, `${tag}\n$1`);
  fs.writeFileSync(file, text, 'utf8');
  return true;
}

function patchDictionaryGenerator() {
  if (!fs.existsSync(GENERATOR_PATH)) return false;
  let text = fs.readFileSync(GENERATOR_PATH, 'utf8');
  if (!text.includes(GTAG_SRC)) return false;

  text = removeAnalyticsTags(text);
  const tag = '<script src="js/analytics.js"></script>';
  const gtagLine = new RegExp(
    `(^[ \\t]*<script(?:\\s+async)?\\s+src=["']${GTAG_SRC.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}["']><\\/script>[ \\t]*$)`,
    'm'
  );
  if (!gtagLine.test(text)) {
    throw new Error('Google tag script line not found in src/generate_dic_html.js');
  }
  text = text.replace(gtagLine, `${tag}\n$1`);
  fs.writeFileSync(GENERATOR_PATH, text, 'utf8');
  return true;
}

function validateHtml(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(GTAG_SRC)) return;
  const candidates = [
    text.indexOf('src="js/analytics.js"'),
    text.indexOf('src="mahler-search-app/js/analytics.js"'),
    text.indexOf('src="/gaswebapp-manual/mahler-search-app/js/analytics.js"')
  ].filter(index => index >= 0);
  const analyticsIndex = candidates.length ? Math.min(...candidates) : -1;
  const gtagIndex = text.indexOf(GTAG_SRC);
  if (analyticsIndex < 0 || analyticsIndex > gtagIndex) {
    throw new Error(`analytics.js must load before gtag in ${path.relative(ROOT, file)}`);
  }
}

const htmlFiles = walkHtml(ROOT);
let patched = 0;
for (const file of htmlFiles) {
  if (patchHtml(file)) patched += 1;
}
patchDictionaryGenerator();

for (const file of htmlFiles) validateHtml(file);
if (fs.existsSync(GENERATOR_PATH)) {
  const generator = fs.readFileSync(GENERATOR_PATH, 'utf8');
  const analyticsIndex = generator.indexOf('src="js/analytics.js"');
  const gtagIndex = generator.indexOf(GTAG_SRC);
  if (gtagIndex >= 0 && (analyticsIndex < 0 || analyticsIndex > gtagIndex)) {
    throw new Error('analytics.js must load before gtag in src/generate_dic_html.js');
  }
}

console.log(`Admin opt-out bootstrap normalized in ${patched} HTML files.`);
