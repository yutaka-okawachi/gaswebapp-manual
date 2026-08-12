const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repositoryRoot = path.resolve(__dirname, '..');
const generatorPath = path.join(repositoryRoot, 'src', 'generate_dic_html.js');
const dictionaryDataPath = path.join(repositoryRoot, 'mahler-search-app', 'data', 'dic_notes.json');
const currentDictionaryPath = path.join(repositoryRoot, 'mahler-search-app', 'dic.html');
const outputPath = path.resolve(
  process.argv[2] || path.join(repositoryRoot, 'mahler-search-app', 'dic_abbreviation_test.html')
);

function decodeHtml(text) {
  const entities = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    '#039': "'"
  };

  return String(text || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const normalized = entity.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(entities, normalized)) {
      return entities[normalized];
    }
    if (normalized.startsWith('#x')) {
      return String.fromCodePoint(parseInt(normalized.slice(2), 16));
    }
    if (normalized.startsWith('#')) {
      return String.fromCodePoint(parseInt(normalized.slice(1), 10));
    }
    return match;
  });
}

function readAbbreviationData(html) {
  const contentMatch = html.match(/<div id="abbrContent">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/);
  if (!contentMatch) {
    throw new Error('The abbreviation list could not be read from mahler-search-app/dic.html.');
  }

  const abbreviationData = [];
  let titleNumber = 0;
  const itemRegex = /<div class="abbr-title"[^>]*>([\s\S]*?)<\/div>|<div class="abbr-row"[^>]*>\s*<span class="abbr-short">([\s\S]*?)<\/span><span class="abbr-long">([\s\S]*?)<\/span>\s*<\/div>/g;
  let match;

  while ((match = itemRegex.exec(contentMatch[1])) !== null) {
    if (match[1] !== undefined) {
      titleNumber += 1;
      abbreviationData.push([titleNumber, decodeHtml(match[1]), '']);
    } else {
      abbreviationData.push(['', decodeHtml(match[2]), decodeHtml(match[3])]);
    }
  }

  return abbreviationData;
}

const generatorSource = fs.readFileSync(generatorPath, 'utf8');
const context = vm.createContext({ console });
vm.runInContext(generatorSource, context, { filename: generatorPath });

const dictionaryData = JSON.parse(fs.readFileSync(dictionaryDataPath, 'utf8'));
const currentDictionaryHtml = fs.readFileSync(currentDictionaryPath, 'utf8');
const abbreviationData = readAbbreviationData(currentDictionaryHtml);

const previewHtml = context.generateDicHtml(dictionaryData, abbreviationData);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, previewHtml, 'utf8');

console.log(`Preview written: ${outputPath}`);
console.log(`Dictionary rows: ${dictionaryData.length}`);
console.log(`Abbreviation rows: ${abbreviationData.length}`);
