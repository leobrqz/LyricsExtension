import { build } from 'esbuild';
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function buildExtension({ outdir = path.join(projectRoot, 'dist'), apiBase, letrasBase, myMemoryBase } = {}) {
  outdir = path.resolve(outdir);
  if (!outdir.startsWith(projectRoot + path.sep)) throw new Error('Build output must stay inside the project.');
  await mkdir(outdir, { recursive: true });
  const source = path.join(projectRoot, 'src');
  const defines = {};
  if (apiBase) defines.__LYRICS_API__ = JSON.stringify(apiBase);
  if (letrasBase) defines.__LETRAS_BASE__ = JSON.stringify(letrasBase);
  if (myMemoryBase) defines.__MYMEMORY_API__ = JSON.stringify(myMemoryBase);
  await build({
    entryPoints: { app: path.join(source, 'src/app.js'), background: path.join(source, 'src/background.js') },
    outdir, bundle: true, format: 'iife', target: 'firefox140', platform: 'browser',
    legalComments: 'eof', define: defines,
  });
  for (const asset of ['popup.html', 'styles.css', 'icons', '_locales']) {
    await cp(path.join(source, asset), path.join(outdir, asset), { recursive: true });
  }
  const bergamot = path.join(projectRoot, 'node_modules/@browsermt/bergamot-translator');
  await mkdir(path.join(outdir, 'bergamot'), { recursive: true });
  for (const asset of ['bergamot-translator-worker.js', 'bergamot-translator-worker.wasm']) {
    await cp(path.join(bergamot, 'worker', asset), path.join(outdir, 'bergamot', asset));
  }
  // Browser-only distribution: omit upstream's Node compatibility shim (which uses eval).
  const worker = await readFile(path.join(bergamot, 'worker/translator-worker.js'), 'utf8');
  const nodeStart = worker.indexOf("if (typeof self === 'undefined')");
  const nodeEnd = worker.indexOf('class YAML');
  if (nodeStart < 0 || nodeEnd < nodeStart) throw new Error('Unrecognized pinned Bergamot worker.');
  let browserWorker = worker.slice(0, nodeStart) + worker.slice(nodeEnd);
  const wasmFetch = "const response = await self.fetch(new URL('./bergamot-translator-worker.wasm', self.location));";
  if (!browserWorker.includes(wasmFetch) || !browserWorker.includes('WebAssembly.instantiateStreaming(response,')) throw new Error('Unrecognized pinned Bergamot WASM loader.');
  // In Firefox offline mode, fetch(moz-extension://...) fails even for packaged files.
  // XHR can read the same local binary without requiring a network connection.
  browserWorker = browserWorker.replace(wasmFetch, `const response = await new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', new URL('./bergamot-translator-worker.wasm', self.location));
    request.responseType = 'arraybuffer';
    request.onload = () => request.response ? resolve(request.response) : reject(new Error('Bundled WASM is unavailable'));
    request.onerror = () => reject(new Error('Cannot read bundled WASM'));
    request.send();
  });`).replace('WebAssembly.instantiateStreaming(response,', 'WebAssembly.instantiate(response,');
  await writeFile(path.join(outdir, 'bergamot/translator-worker.js'), '// Bergamot 0.4.9, MPL-2.0. Browser shim and offline WASM loader changes; see README credits.\n' + browserWorker);
  await cp(path.join(source, 'licenses'), path.join(outdir, 'licenses'), { recursive: true });
  const manifest = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8'));
  if (apiBase || letrasBase || myMemoryBase) {
    const origins = [...new Set([apiBase, letrasBase, myMemoryBase].filter(Boolean).map(value => new URL(value).origin))];
    manifest.host_permissions.push(...origins.map(origin => `${origin}/*`));
    manifest.content_security_policy.extension_pages = manifest.content_security_policy.extension_pages.replace('connect-src ', `connect-src ${origins.join(' ')} `);
  }
  await writeFile(path.join(outdir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  for (const name of ['LICENSE', 'README.md']) {
    await cp(path.join(projectRoot, name), path.join(outdir, name));
  }
  return outdir;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = await buildExtension();
  console.log(`Extension built: ${output}`);
}
