import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

// PocketBase hooks use CommonJS inside their own VM, independently of the
// frontend's ESM package scope. Exercise that same loading model in unit tests.
export function loadHook(name, globals = {}) {
  const hooks = new URL('../../Backend/pb_hooks/', import.meta.url);
  const cache = new Map();
  function load(url) {
    if (cache.has(url.href)) return cache.get(url.href).exports;
    const module = { exports: {} };
    cache.set(url.href, module);
    vm.runInNewContext(readFileSync(url, 'utf8'), {
      ...globals, module, __hooks: fileURLToPath(hooks),
      require: path => load(pathToFileURL(path)),
    }, { filename: fileURLToPath(url) });
    return module.exports;
  }
  return load(new URL(name, hooks));
}
