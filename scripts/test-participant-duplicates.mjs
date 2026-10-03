// Integration tests against a disposable local PocketBase database.
// Run: node scripts/test-participant-duplicates.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const binary = process.env.POCKETBASE_BIN || join(root, 'Backend', 'pocketbase.exe');
const dir = mkdtempSync(join(tmpdir(), 'methric-participant-duplicates-'));
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
let adminToken = '';
async function request(path, body, method = body ? 'POST' : 'GET', expectedStatus = 200) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: path.startsWith('/api/admin/') ? adminToken : token }, ...(body ? { body: JSON.stringify(body) } : {}) });
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
    await create('admins', { email: 'admin@example.test', password, passwordConfirm: password });
    adminToken = (await request('/api/collections/admins/auth-with-password', { identity: 'admin@example.test', password })).token;
    const profile = { name: 'Ada Lovelace', email: 'ada@example.test', referenceDate: daysAgo(0), entryMode: 'day', type: 'student' };
    const created = await request('/api/admin/participants', profile);
    assert.ok(created.participantId);
    for (const [changes, fields] of [
        [{ name: '  ADA   Lovelace  ', email: 'other@example.test' }, ['name']],
        [{ name: 'Different Person', email: ' ADA@EXAMPLE.TEST ' }, ['email']],
        [{ name: 'ada lovelace', email: 'ada@example.test' }, ['name', 'email']],
    ]) {
        const result = await request('/api/admin/participants', { ...profile, ...changes }, 'POST', 409);
        assert.deepEqual(result.duplicateFields, fields);
    }
    await request(`/api/admin/participant?participantId=${created.participantId}`, { ...profile, inactive: true }, 'PATCH');
    assert.deepEqual((await request('/api/admin/participants', profile, 'POST', 409)).duplicateFields, ['name', 'email']);
    await request('/api/admin/participants', { ...profile, name: 'Alan Turing', email: 'alan@example.test' });
    await request('/api/admin/participants', { ...profile, name: 'Grace Hopper', email: 'grace@example.test' });
    const records = await request('/api/collections/participants/records');
    assert.equal(records.totalItems, 3);
    console.log('PASS: duplicate names and emails rejected, including inactive participants; distinct names and emails accepted.');
} catch (error) {
    console.error(log.slice(-4000));
    throw error;
} finally {
    server.kill();
}





