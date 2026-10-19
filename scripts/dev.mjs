import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildExtension, projectRoot } from './build.mjs';

await buildExtension();
const candidates = [process.env.FIREFOX_BINARY, 'C:/Program Files/Mozilla Firefox/firefox.exe', 'C:/Program Files (x86)/Mozilla Firefox/firefox.exe', '/Applications/Firefox.app/Contents/MacOS/firefox', '/usr/bin/firefox'].filter(Boolean);
const binary = candidates.find(candidate => existsSync(candidate));
const args = [path.join(projectRoot, 'node_modules/web-ext/bin/web-ext.js'), 'run', '--source-dir', path.join(projectRoot, 'dist')];
if (binary) args.push('--firefox', binary);
const child = spawn(process.execPath, args, { cwd: projectRoot, stdio: 'inherit', windowsHide: true });
let timer;
let rebuilding = false;
let pending = false;
async function rebuild() {
  if (rebuilding) { pending = true; return; }
  rebuilding = true;
  try { await buildExtension(); console.log('Rebuilt extension.'); }
  catch (error) { console.error(error.message); }
  finally { rebuilding = false; if (pending) { pending = false; rebuild(); } }
}
const watcher = watch(path.join(projectRoot, 'src'), { recursive: true }, () => {
  clearTimeout(timer); timer = setTimeout(rebuild, 180);
});
child.on('exit', code => { watcher.close(); clearTimeout(timer); process.exitCode = code || 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { watcher.close(); clearTimeout(timer); child.kill(); });
