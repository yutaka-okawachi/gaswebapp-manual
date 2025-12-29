
// Mock data and function for local testing
const rsJson = [
  { 'Oper': 'Salome', 'Whom': 'Salome, Jochanaan' },
  { 'Oper': 'Salome', 'Whom': 'Herodes, Salome' },
  { 'Oper': 'Elektra', 'Whom': 'Elektra' }
];

const rwJson = [
  { 'Oper': 'Tristan', 'Whom': 'Tristan, Isolde' },
  { 'Oper': 'Tristan', 'Whom': 'Isolde, Brangäne' },
  { 'Oper': 'Walküre', 'Whom': 'Siegmund, Sieglinde' }
];

const extractTargets = (jsonArray) => {
    const targetMap = {};
    jsonArray.forEach(row => {
        const opera = String(row['Oper'] || '').toLowerCase().trim();
        const whom = String(row['Whom'] || '').trim();
        if (opera && whom) {
            if (!targetMap[opera]) targetMap[opera] = new Set();
            whom.split(',').forEach(p => {
                const trimmed = p.trim();
                if (trimmed) targetMap[opera].add(trimmed);
            });
        }
    });
    // Convert sets to sorted arrays
    const result = {};
    for (const opera in targetMap) {
        result[opera] = Array.from(targetMap[opera]).sort();
    }
    return result;
};

const targetsIndex = {
    rs: extractTargets(rsJson),
    rw: extractTargets(rwJson)
};

console.log(JSON.stringify(targetsIndex, null, 2));
