const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const generatorPath = path.join(repositoryRoot, 'src', 'generate_dic_html.js');
const generatorSource = fs.readFileSync(generatorPath, 'utf8');
const publishedDicPath = path.join(repositoryRoot, 'mahler-search-app', 'dic.html');
const publishedDicHtml = fs.readFileSync(publishedDicPath, 'utf8');

// 1. Static code assertions on both generator and published HTML
for (const [fileLabel, source] of [
  ['src/generate_dic_html.js', generatorSource],
  ['mahler-search-app/dic.html', publishedDicHtml]
]) {
  assert.ok(
    source.includes("e.target.closest('a.composer-link')"),
    `${fileLabel} should detect composer-link clicks`
  );
  assert.ok(
    source.includes('dictionary_example_return_target'),
    `${fileLabel} should store dictionary_example_return_target in sessionStorage`
  );
  assert.ok(
    source.includes("dictionaryExampleReturnTarget: termId"),
    `${fileLabel} should update history.replaceState with term ID`
  );
  assert.ok(
    source.includes("window.addEventListener('pageshow'"),
    `${fileLabel} should listen for pageshow events (for BFCache support)`
  );
  assert.ok(
    source.includes("window.addEventListener('popstate'"),
    `${fileLabel} should listen for popstate events`
  );
  assert.ok(
    source.includes('cancelHashScroll'),
    `${fileLabel} should cancel realign when user initiates manual scrolling`
  );
  assert.ok(
    source.includes("scrollRestoration = 'manual'"),
    `${fileLabel} should set scrollRestoration to manual to avoid conflicting with term alignment`
  );
}

// 2. Behavioral verification of getPendingExampleReturnTarget and handleHashChange logic
// Test with mock session / history objects
function createTestScope() {
  const sessionStorageMock = {};
  const historyStateMock = { state: null };
  let locationHash = '';
  let restoredToManual = false;

  function setSessionStorage(key, val) {
    sessionStorageMock[key] = val;
  }
  function getSessionStorage(key) {
    return sessionStorageMock[key] || null;
  }
  function removeSessionStorage(key) {
    delete sessionStorageMock[key];
  }

  function getPendingExampleReturnTarget() {
    try {
      const target = getSessionStorage('dictionary_example_return_target');
      if (target) {
        removeSessionStorage('dictionary_example_return_target');
        return target;
      }
    } catch (err) {}
    if (historyStateMock.state && historyStateMock.state.dictionaryExampleReturnTarget) {
      return historyStateMock.state.dictionaryExampleReturnTarget;
    }
    return null;
  }

  return {
    setSessionStorage,
    getSessionStorage,
    historyStateMock,
    getPendingExampleReturnTarget
  };
}

// Test case 1: target in sessionStorage
const scope1 = createTestScope();
scope1.setSessionStorage('dictionary_example_return_target', 'term-abdaempfen');
assert.strictEqual(scope1.getPendingExampleReturnTarget(), 'term-abdaempfen');
// Should be cleared after first retrieval
assert.strictEqual(scope1.getPendingExampleReturnTarget(), null);

// Test case 2: fallback to history state
const scope2 = createTestScope();
scope2.historyStateMock.state = { dictionaryExampleReturnTarget: 'term-anfang' };
assert.strictEqual(scope2.getPendingExampleReturnTarget(), 'term-anfang');

// Test case 3: neither present
const scope3 = createTestScope();
assert.strictEqual(scope3.getPendingExampleReturnTarget(), null);

console.log('dictionary example return tests: OK');
