const { run, request, delay, sha256, normalizeText, git } = require('./core');
const logger = require('./logger');
function token() {
    if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    const data = run('git', ['credential', 'fill'], { redactError: true, input: 'protocol=https\nhost=github.com\n\n', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    const match = data.match(/^password=(.+)$/m);
    if (!match) throw new Error('GitHub 認証が必要です。');
    return match[1].trim();
}
async function api(slug, endpoint, credential) {
    return (await request(`https://api.github.com/repos/${slug}${endpoint}`, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${credential}` }
    })).json();
}
async function preflight(slug, credential) {
    const repo = await api(slug, '', credential);
    if (!repo.permissions || !repo.permissions.push) throw new Error('GitHub リポジトリへの書き込み権限を確認できません。');
    const pages = await api(slug, '/pages', credential);
    if (!pages.html_url) throw new Error('GitHub Pages の公開URLを確認できません。');
    return pages.html_url.replace(/\/?$/, '/');
}
function deploymentState(runs, builds, sha) {
    const candidates = runs.filter(run => run.head_sha === sha && /pages/i.test(`${run.name} ${run.path}`));
    if (candidates.length) {
        const newest = candidates.sort((a, b) => b.id - a.id)[0];
        if (newest.status !== 'completed') return 'pending';
        return newest.conclusion === 'success' ? 'success' : 'failure';
    }
    const build = builds.find(build => build.commit === sha);
    return !build ? 'pending' : build.status === 'built' ? 'success' : build.status === 'errored' ? 'failure' : 'pending';
}
async function verifyPages(slug, sha, credential, baseUrl, manifest) {
    const deadline = Date.now() + 10 * 60 * 1000;
    let last = '';
    while (Date.now() < deadline) {
        const runs = await api(slug, `/actions/runs?head_sha=${sha}&per_page=100`, credential);
        let builds = [];
        if (!(runs.workflow_runs || []).some(run => /pages/i.test(`${run.name} ${run.path}`))) {
            try { builds = await api(slug, '/pages/builds?per_page=20', credential); } catch (_) { /* Workflow-backed Pages has no legacy builds. */ }
        }
        const status = deploymentState(runs.workflow_runs || [], builds, sha);
        if (status === 'failure') throw new Error('最終コミットの GitHub Pages 公開に失敗しました。');
        if (status === 'success') {
            try {
                const live = await (await request(`${baseUrl}mahler-search-app/release.json?v=${manifest.releaseId}`)).json();
                if (live.releaseId !== manifest.releaseId) throw new Error('公開ファイルの反映待ち');
                // Check every published text artifact, including all 48 example shards.
                const entries = Object.entries(manifest.hashes);
                for (let offset = 0; offset < entries.length; offset += 6) {
                    await Promise.all(entries.slice(offset, offset + 6).map(async ([file, hash]) => {
                        const text = await (await request(`${baseUrl}${file}?v=${manifest.releaseId}`)).text();
                        if (sha256(normalizeText(text)) !== hash) throw new Error(`公開内容が不一致: ${file}`);
                        if (file.endsWith('.json')) JSON.parse(text);
                    }));
                }
                if ((await api(slug, '/git/ref/heads/main', credential)).object.sha !== sha) throw new Error('検証中に main が更新されました。再実行してください。');
                return;
            } catch (e) { last = e.message; }
        }
        logger.wait(`Pages の公開確認を継続中…${last ? ' (' + last + ')' : ''}`);
        await delay(10000);
    }
    throw new Error(`公開確認がタイムアウトしました。再実行で確認を再開します。${last}`);
}
function push() { git('push', 'origin', 'HEAD:main'); return git('rev-parse', 'HEAD'); }
module.exports = { token, preflight, deploymentState, verifyPages, push };
