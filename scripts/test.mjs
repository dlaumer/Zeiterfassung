import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const tests = readdirSync(new URL('./', import.meta.url)).filter(name => /^test-.+\.mjs$/.test(name)).sort();
const failures = [];
for (const name of tests) {
  console.log(`\n${name}`);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(name, import.meta.url))], { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) failures.push(name);
}
console.log(`\n${tests.length - failures.length}/${tests.length} test scripts passed.`);
if (failures.length) console.error('Failed:', failures.join(', '));
process.exitCode = failures.length ? 1 : 0;
