// Integration tests against a disposable local PocketBase database.
// Run: node scripts/test-removed-module-history.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const binary = process.env.POCKETBASE_BIN || join(root, 'Backend', 'pocketbase.exe');
const dir = mkdtempSync(join(tmpdir(), 'methric-participant-status-'));
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
    const participant = await create('participants', { name: 'Module visibility', email: 'visibility@example.test', entryMode: 'day' });
    const subject = await create('subjects', { key: 'visibility', label_en: 'Visibility', label_de: 'Visibility', entryMode: 'day' });
    const enrollment = await create('participant_subjects', { participant: participant.id, subject: subject.id, color: '#e6194b' });
    const payload = { participantId: participant.id, date: daysAgo(0), inputMode: 'totals', expectedSubmissionId: '', reliability: 4, socialBattery: 3, subjectTimes: [{ subjectId: subject.id, classMinutes: 120, studyMinutes: 60 }] };
    const initial = await request('/api/submissions/daily', payload);
    await request(`/api/collections/participant_subjects/records/${enrollment.id}`, undefined, 'DELETE', 204);
    await request('/api/submissions/daily', { ...payload, expectedSubmissionId: initial.submissionId, subjectTimes: [], comment: 'Edit while module is hidden' });
    const history = await request(`/api/workload-status?participantId=${participant.id}`);
    assert.equal(history.submissionHistory[0].subjects[0].classTime, 2);
    assert.equal(history.submissionHistory[0].subjects[0].selfStudyTime, 1);
    const restored = await create('participant_subjects', { participant: participant.id, subject: subject.id, color: '#3cb44b' });
    assert.equal(restored.color, '#3cb44b');
    assert.deepEqual((await request(`/api/workload-status?participantId=${participant.id}`)).submissionHistory, history.submissionHistory);
    console.log('PASS: removing a module and editing the day preserves its history; reselecting with a new color retains all time.');
} catch (error) {
    console.error(log.slice(-4000));
    throw error;
} finally {
    server.kill();
}
