import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import PocketBase from 'pocketbase';

// Exercise the component's loader with the real SDK and controlled responses.
const source = readFileSync(new URL('../src/admin/AdminApp.tsx', import.meta.url), 'utf8');
const loader = source.slice(source.indexOf('  async function loadOverview('), source.indexOf('  async function handleLogin('))
  .replace('pb.send<AdminOverview>', 'pb.send');
const requests = [];
const pb = new PocketBase('https://example.test');
pb.beforeSend = (url, options) => ({ url, options: {
  ...options,
  fetch: (_url, init) => new Promise((resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    requests.push({
      resolve: (data, status = 200) => resolve(new Response(JSON.stringify(data), { status })),
      truncate: () => resolve({ status: 200, json: async () => { throw new TypeError('Connection reset'); } }),
    });
  }),
} });
let authenticated = true;
let overview;
let status = 'loading';
const errors = [];
const emptyOverview = { participants: [], subjects: [], events: [] };
const load = new Function('pb', 'overviewRequestId', 'setOverview', 'setStatus', 'emptyOverview', 'console', 'isAuthenticated',
  `return async function(silent = false) { const isAdminAuthenticated = isAuthenticated(); ${loader}; return loadOverview(silent); }`)(
  pb, { current: 0 }, (value) => { overview = value; },
  (value) => { status = typeof value === 'function' ? value(status) : value; },
  emptyOverview, { error: (...args) => errors.push(args) }, () => authenticated,
);
const initial = load();
const refresh = load(true);
await new Promise(setImmediate);
requests[1].resolve({ participants: ['latest'], subjects: [], events: [] });
await refresh;
requests[0].resolve({ participants: ['stale'] });
await initial;
assert.deepEqual(overview, { participants: ['latest'], subjects: [], events: [] });
assert.equal(status, 'ready');
assert.equal(errors.length, 0, 'Overlapping requests must not cancel each other');

for (const response of [{}, null, { participants: [] }, { participants: [], subjects: [], events: null }]) {
  const malformed = load();
  await new Promise(setImmediate);
  requests.at(-1).resolve(response);
  await malformed;
  assert.equal(status, 'error', 'Malformed responses must be handled as load errors');
  assert.deepEqual(overview, { participants: ['latest'], subjects: [], events: [] });
}

const truncated = load();
await new Promise(setImmediate);
requests.at(-1).truncate();
await truncated;
assert.equal(status, 'error', 'A reset during a 200 response body must not publish the SDK fallback object');
assert.deepEqual(overview, { participants: ['latest'], subjects: [], events: [] });
const manualIndex = requests.length;
const manual = load();
const failingRefresh = load(true);
await new Promise(setImmediate);
requests[manualIndex + 1].resolve({ message: 'Unavailable' }, 500);
await failingRefresh;
requests[manualIndex].resolve({ participants: ['stale again'] });
await manual;
assert.equal(status, 'error', 'A failed refresh during loading must settle the loading state');
assert.deepEqual(overview, { participants: ['latest'], subjects: [], events: [] }, 'Keep existing data after a failure');

const pending = load();
authenticated = false;
await load();
await new Promise(setImmediate);
requests.at(-1).resolve({ participants: ['private'] });
await pending;
assert.deepEqual(overview, emptyOverview, 'A response after logout must not restore private data');
assert.equal(status, 'ready');
console.log('Admin overview loading tests passed.');
