
// Mocking backend search logic
const WagnerData = [
  { oper: 'tristan', whom: 'Tristan, Isolde', de: 'De1', ja: 'Ja1', page: 10 },
  { oper: 'tristan', whom: 'Brangäne', de: 'De2', ja: 'Ja2', page: 12 },
  { oper: 'walküre', whom: 'Siegmund', de: 'De3', ja: 'Ja3', page: 15 }
];

function mockNormalize(str) {
  return str.toLowerCase().trim();
}

function searchWagnerByTarget(operaName, targetFilter) {
    const normalizedOperaName = mockNormalize(operaName);
    
    const filteredData = WagnerData.filter(row => {
      const sheetOperaValue = mockNormalize(row.oper);
      if (sheetOperaValue !== normalizedOperaName) return false;
      if (!row.whom) return false;

      const rowTargets = row.whom.toString().split(',').map(s => s.trim());
      // 和集合（OR）
      return rowTargets.some(t => targetFilter.includes(t));
    });

    return filteredData;
}

// Test cases
console.log('Test 1: Tristan - [Isolde]');
const res1 = searchWagnerByTarget('Tristan', ['Isolde']);
console.log(res1.length === 1 && res1[0].whom.includes('Isolde') ? 'SUCCESS' : 'FAILURE');

console.log('Test 2: Tristan - [Tristan, Brangäne]');
const res2 = searchWagnerByTarget('Tristan', ['Tristan', 'Brangäne']);
console.log(res2.length === 2 ? 'SUCCESS' : 'FAILURE');

console.log('Test 3: Walküre - [Siegmund]');
const res3 = searchWagnerByTarget('walküre', ['Siegmund']);
console.log(res3.length === 1 ? 'SUCCESS' : 'FAILURE');

console.log('Test 4: Non-matching target');
const res4 = searchWagnerByTarget('Tristan', ['Siegmund']);
console.log(res4.length === 0 ? 'SUCCESS' : 'FAILURE');
