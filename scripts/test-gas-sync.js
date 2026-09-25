const assert = require('assert');
const { inspect, exportSnapshotForSource, waitForSourceHash, DEPLOYMENT_VERIFY_DELAYS_MS, INSPECTION_RETRY_DELAYS_MS, SNAPSHOT_SOURCE_RETRY_DELAYS_MS } = require('./sync/gas');

async function main() {
    let inspectionCalls = 0;
    const inspectionWaits = [];
    const inspected = await inspect({}, {
        delays: [0, 1],
        delay: async ms => inspectionWaits.push(ms),
        call: async () => {
            inspectionCalls += 1;
            if (inspectionCalls === 1) throw new Error('HTTP 404');
            return { sourceHash: 'current' };
        }
    });
    assert.strictEqual(inspected.sourceHash, 'current');
    assert.deepStrictEqual(inspectionWaits, [0, 1]);
    assert.deepStrictEqual(INSPECTION_RETRY_DELAYS_MS, [0, 2000, 5000, 10000]);

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

    const snapshotWaits = [];
    const snapshotIds = [];
    const snapshots = [{ sourceHash: 'old' }, { sourceHash: 'expected' }];
    const snapshot = await exportSnapshotForSource({}, 'request-id', 'expected', {
        delays: [0, 1], delay: async ms => snapshotWaits.push(ms),
        fetchSnapshot: async (settings, requestId) => { snapshotIds.push(requestId); return snapshots.shift(); }
    });
    assert.strictEqual(snapshot.sourceHash, 'expected');
    assert.deepStrictEqual(snapshotWaits, [0, 1]);
    assert.deepStrictEqual(snapshotIds, ['request-id', 'request-id']);
    assert.deepStrictEqual(SNAPSHOT_SOURCE_RETRY_DELAYS_MS, [0, 5000, 15000, 30000]);
    await assert.rejects(() => exportSnapshotForSource({}, 'request-id', 'expected', {
        delays: [0, 1], delay: async () => {}, fetchSnapshot: async () => ({ sourceHash: 'old' })
    }), /期待値: expected、確認値: old/);
    console.log('GAS deployment retry tests: OK');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
