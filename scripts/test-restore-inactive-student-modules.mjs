// Integration tests against a disposable local PocketBase database.
// Run: node scripts/test-restore-inactive-student-modules.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const binary = process.env.POCKETBASE_BIN || join(root, 'Backend', 'pocketbase.exe');
const dir = mkdtempSync(join(tmpdir(), 'methric-module-recovery-'));
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
    const { default: PocketBase } = await import('pocketbase');
    const { restoreModules } = await import('./restore-inactive-student-modules.mjs');
    const pb = new PocketBase(base);
    pb.authStore.save(token);
    // Production has a type field that predates the checked-in schema migrations.
    const schema = await pb.collections.getOne('participants');
    if (!schema.fields.some(field => field.name === 'type')) await pb.collections.update(schema.id, { fields: [...schema.fields, { name: 'type', type: 'select', values: ['student', 'faculty'], maxSelect: 1 }] });
    const subjects = [];
    for (const key of ['one', 'two', 'three']) subjects.push(await create('subjects', { key, label_en: key, label_de: key, entryMode: 'day' }));
    const people = [];
    for (const [type, inactive] of [['student', true], ['student', false], ['faculty', true], ['student', true]]) {
        people.push(await create('participants', { name: `Person ${people.length}`, email: 'student' + people.length + '@example.test', type, inactive, entryMode: 'day' }));
    }
    const existing = await create('participant_subjects', { participant: people[0].id, subject: subjects[0].id, color: '#123456' });
    for (const person of people.slice(0, 3)) {
        const submission = await create('submissions', { participant: person.id, periodType: 'day', periodStart: `${daysAgo(0)} 00:00:00.000Z`, periodEnd: `${daysAgo(0)} 00:00:00.000Z`, submittedAt: new Date().toISOString(), submissionMode: 'initial' });
        for (const subject of [...subjects, subjects[1]]) await create('submission_items', { submission: submission.id, workloadType: subject.id, type: 'class', durationMinutes: 60 });
    }
    const beforeSubmissions = await pb.collection('submissions').getFullList();
    const beforeItems = await pb.collection('submission_items').getFullList();
    const beforePeople = await pb.collection('participants').getFullList();
    const colors = [{ participant: people[0].id, subject: subjects[1].id, color: '#abcdef' }];
    const options = { colors, log: () => {} };
    const preview = await restoreModules(pb, options);
    assert.equal(preview.proposed.length, 2);
    assert.equal(preview.skipped.length, 1);
    assert.equal((await pb.collection('participant_subjects').getFullList()).length, 1);
    const applied = await restoreModules(pb, { ...options, apply: true });
    assert.equal(applied.added, 2);
    assert.deepEqual(applied.proposed.map(({ enrollmentId, ...row }) => row), preview.proposed);
    const after = await pb.collection('participant_subjects').getFullList();
    assert.equal(after.length, 3);
    assert.deepEqual(after.find(row => row.id === existing.id), existing);
    assert.equal(after.find(row => row.subject === subjects[1].id).color, '#abcdef');
    assert.equal(new Set(after.map(row => row.color)).size, 3);
    assert.equal((await restoreModules(pb, { ...options, apply: true })).added, 0);
    assert.deepEqual(await pb.collection('submissions').getFullList(), beforeSubmissions);
    assert.deepEqual(await pb.collection('submission_items').getFullList(), beforeItems);
    assert.deepEqual(await pb.collection('participants').getFullList(), beforePeople);
    console.log('PASS: preview, inactive-student scope, duplicate history, preserved assignments/data, backup/replacement colors, no-history flag and idempotent rerun.');
} catch (error) {
    console.error(log.slice(-4000));
    throw error;
} finally {
    server.kill();
}


