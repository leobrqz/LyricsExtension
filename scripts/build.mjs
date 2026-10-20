import { build } from 'esbuild';
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function buildExtension({ outdir = path.join(projectRoot, 'dist'), apiBase, letrasBase } = {}) {
  outdir = path.resolve(outdir);
  if (!outdir.startsWith(projectRoot + path.sep)) throw new Error('Build output must stay inside the project.');
  await mkdir(outdir, { recursive: true });
  const source = path.join(projectRoot, 'src');
  const defines = {};
  if (apiBase) defines.__LYRICS_API__ = JSON.stringify(apiBase);
  if (letrasBase) defines.__LETRAS_BASE__ = JSON.stringify(letrasBase);
  await build({
    entryPoints: { app: path.join(source, 'src/app.js'), background: path.join(source, 'src/background.js') },
    outdir, bundle: true, format: 'iife', target: 'firefox140', platform: 'browser',
    legalComments: 'eof', define: defines,
  });
  for (const asset of ['popup.html', 'styles.css', 'icons', '_locales']) {
    await cp(path.join(source, asset), path.join(outdir, asset), { recursive: true });
  }
  const manifest = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8'));
  if (apiBase || letrasBase) {
    const origins = [...new Set([apiBase, letrasBase].filter(Boolean).map(value => new URL(value).origin))];
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
