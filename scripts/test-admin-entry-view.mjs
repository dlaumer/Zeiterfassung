// Integration tests against a disposable local PocketBase database.
// Run: node scripts/test-submission-corrections.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const binary = process.env.POCKETBASE_BIN || join(root, 'Backend', 'pocketbase.exe');
const dir = mkdtempSync(join(tmpdir(), 'methric-corrections-'));
const migrations = join(root, 'Backend', 'pb_migrations');
const hooks = join(root, 'Backend', 'pb_hooks');
const password = 'disposable-integration-test-9284!';
execFileSync(binary, ['migrate', 'up', '--dir', dir, '--migrationsDir', migrations], { windowsHide: true });
execFileSync(binary, ['superuser', 'upsert', 'test@example.test', password, '--dir', dir], { windowsHide: true });
const portProbe = createServer();
await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve));
const port = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const server = spawn(binary, ['serve', '--http', `127.0.0.1:${port}`, '--dir', dir, '--hooksDir', hooks, '--migrationsDir', migrations], { windowsHide: true, stdio: 'pipe' });
let log = '';
server.stdout.on('data', chunk => { log += chunk; });
server.stderr.on('data', chunk => { log += chunk; });
let token = '';
async function request(path, body, method = body ? 'POST' : 'GET', expectedStatus = 200) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: token }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text();
    assert.equal(response.status, expectedStatus, `${method} ${path}: ${text}`);
    try { return JSON.parse(text); } catch { return text; }
}
const create = (collection, data) => request(`/api/collections/${collection}/records`, data);
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return dateKey(d); };
try {
    for (let i = 0; i < 80; i++) {
        try { if ((await fetch(base + '/api/health')).ok) break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    token = (await request('/api/collections/_superusers/auth-with-password', { identity: 'test@example.test', password })).token;
    const superuserToken = token;
    await create('admins', { email: 'admin@example.test', password, passwordConfirm: password });
    const adminToken = (await request('/api/collections/admins/auth-with-password', { identity: 'admin@example.test', password })).token;
    // Admin entry view requires a verified admins token, even when a flag is supplied.
    for (const mode of ['day', 'week']) {
        for (const role of ['student', 'faculty']) {
            token = superuserToken;
            const person = await create('participants', { name: 'Admin override', email: mode + role + '@example.test', entryMode: mode, type: role });
            const endpoint = '/api/submissions/' + (mode === 'day' ? 'daily' : 'weekly');
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 42);
            if (mode === 'week') oldDate.setDate(oldDate.getDate() - (oldDate.getDay() + 6) % 7);
            const data = { participantId: person.id, inputMode: 'totals', expectedSubmissionId: '', reliability: 4, socialBattery: 3, adminEffortMinutes: 30, subjectTimes: [], categoryTimes: [], ...(mode === 'day' ? { date: dateKey(oldDate) } : { weekStart: dateKey(oldDate) }) };
            const saved = await request(endpoint, data);
            const change = { ...data, expectedSubmissionId: saved.submissionId, adminEffortMinutes: 60 };
            await request(endpoint, { ...change, adminView: true }, 'POST', 401); // Wrong auth collection.
            token = '';
            await request('/api/workload-status?participantId=' + person.id + '&adminView=true', undefined, 'GET', 401);
            await request(endpoint, { ...change, adminView: true }, 'POST', 401);
            await request(endpoint, { ...change, adminView: true }, 'DELETE', 401);
            await request(endpoint, change, 'POST', 400);
            token = adminToken;
            await request(endpoint, change, 'POST', 400); // Normal participant view stays restricted.
            assert.equal((await request('/api/workload-status?participantId=' + person.id + '&adminView=true')).adminViewAuthorized, true);
            const corrected = await request(endpoint, { ...change, adminView: true });
            assert.equal(corrected.submissionMode, 'correction');
            await request(endpoint, { ...change, adminView: true }, 'POST', 400); // Stale edits still rejected.
            assert.equal((await request('/api/workload-status?participantId=' + person.id)).adminViewAuthorized, false);
            assert.equal((await request('/api/workload-status?participantId=' + person.id)).submissionHistory[0].generalAdminTime, 60);
        }
    }
    console.log('PASS: authenticated admin overrides for daily/weekly students and faculty; unauthorized and stale requests rejected.');
 } catch (error) { console.error(log.slice(-4000)); throw error; } finally { server.kill(); }
