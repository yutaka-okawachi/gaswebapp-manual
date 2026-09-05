const assert = require('assert');
const { waitForSourceHash, DEPLOYMENT_VERIFY_DELAYS_MS } = require('./sync/gas');

async function main() {
    const waits = [];
    const responses = [new Error('一時的な HTTP エラー'), { sourceHash: 'old' }, { sourceHash: 'expected' }];
    const result = await waitForSourceHash({}, 'expected', {
        delays: [0, 1, 2],
        delay: async ms => waits.push(ms),
        inspect: async () => {
            const value = responses.shift();
            if (value instanceof Error) throw value;
            return value;
        }
    });
    assert.strictEqual(result.sourceHash, 'expected');
    assert.deepStrictEqual(waits, [0, 1, 2]);
    assert.deepStrictEqual(DEPLOYMENT_VERIFY_DELAYS_MS, [0, 2000, 5000, 10000, 20000]);

    await assert.rejects(() => waitForSourceHash({}, 'expected', {
        delays: [0, 1], delay: async () => {}, inspect: async () => ({ sourceHash: 'old' })
    }), /再実行すると反映済みのデプロイを再利用/);

    await assert.rejects(() => waitForSourceHash({}, 'expected', {
        delays: [0], delay: async () => {}, inspect: async () => { throw new Error('timeout'); }
    }), /最後のエラー: timeout/);
    console.log('GAS deployment retry tests: OK');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
