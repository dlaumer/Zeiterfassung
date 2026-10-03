// Integration tests against a disposable local PocketBase database.
// Run: node scripts/test-subject-edit.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const binary = process.env.POCKETBASE_BIN || join(root, 'Backend', 'pocketbase.exe');
const dir = mkdtempSync(join(tmpdir(), 'methric-subject-edit-'));
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
    const subject = await create('subjects', { key: 'original', label_en: 'English', label_de: 'Deutsch', credits: 2, entryMode: 'day' });
    const participant = await create('participants', { name: 'Test', email: 'person@example.test', type: 'student', entryMode: 'day' });
    const enrollment = await create('participant_subjects', { participant: participant.id, subject: subject.id });
    const submission = await create('submissions', { participant: participant.id, periodType: 'day', periodStart: '2026-09-28 00:00:00.000Z', periodEnd: '2026-09-28 00:00:00.000Z', submittedAt: new Date().toISOString(), submissionMode: 'initial' });
    const item = await create('submission_items', { submission: submission.id, workloadType: subject.id, type: 'class', durationMinutes: 60 });
    const profile = { key: 'renamed', number: '123', labelEn: 'Updated English', labelDe: 'Updated German', credits: 4.5 };
    const endpoint = `/api/admin/subject?subjectId=${subject.id}`;
    const auth = adminToken;
    adminToken = '';
    await request(endpoint, profile, 'PATCH', 401);
    adminToken = auth;
    await request(endpoint, profile, 'PATCH');
    const saved = await request(`/api/collections/subjects/records/${subject.id}`);
    assert.equal(saved.key, profile.key);
    assert.equal(saved.number, profile.number);
    assert.equal(saved.label_en, profile.labelEn);
    assert.equal(saved.label_de, profile.labelDe);
    assert.equal(saved.credits, profile.credits);
    assert.equal(saved.entryMode, 'day');
    assert.deepEqual(await request(`/api/collections/participant_subjects/records/${enrollment.id}`), enrollment);
    assert.deepEqual(await request(`/api/collections/submission_items/records/${item.id}`), item);
    for (const invalid of [{ key: ' ' }, { labelEn: '', labelDe: '' }, { credits: -1 }, { credits: 'invalid' }]) {
        await request(endpoint, { ...profile, ...invalid }, 'PATCH', 400);
        assert.deepEqual(await request(`/api/collections/subjects/records/${subject.id}`), saved);
    }
    const overview = await request('/api/admin/overview');
    assert.equal(overview.subjects.find(row => row.id === subject.id).labelEn, profile.labelEn);
    console.log('PASS: module editing, validation, authentication, overview refresh, and preservation of assignments and history.');
} catch (error) {
    console.error(log.slice(-4000));
    throw error;
} finally {
    server.kill();
}

