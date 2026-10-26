import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import firefox from 'selenium-webdriver/firefox.js';
import { buildExtension, projectRoot } from './build.mjs';
import { startFirefox } from './firefox.mjs';

// Short excerpts from public-domain songs. Keep the input identical for both engines.
const songs = [
  { title: 'Scarborough Fair', source: 'en', lyrics: 'Are you going to Scarborough Fair?\nParsley, sage, rosemary and thyme.' },
  { title: 'Amazing Grace', source: 'en', lyrics: 'Amazing grace, how sweet the sound\nThat saved a wretch like me\nI once was lost, but now am found\nWas blind, but now I see' },
  { title: 'Greensleeves', source: 'en', lyrics: 'Alas, my love, you do me wrong\nTo cast me off discourteously\nFor I have loved you well and long' },
  { title: 'The House of the Rising Sun', source: 'en', lyrics: "There is a house in New Orleans\nThey call the Rising Sun\nAnd it's been the ruin of many a poor boy" },
  { title: 'The Water Is Wide', source: 'en', lyrics: "The water is wide, I cannot get o'er\nAnd neither have I wings to fly\nGive me a boat that can carry two" },
  { title: 'Shenandoah', source: 'en', lyrics: 'Oh Shenandoah, I long to hear you\nAway, you rolling river\nOh Shenandoah, I long to hear you' },
  { title: 'Au clair de la lune', source: 'fr', lyrics: 'Au clair de la lune\nMon ami Pierrot\nPrête-moi ta plume\nPour écrire un mot' },
  { title: 'Los pollitos dicen', source: 'es', lyrics: 'Los pollitos dicen pío, pío, pío\nCuando tienen hambre\nCuando tienen frío' },
];

const output = path.join(projectRoot, 'artifacts/translation-comparison');
await mkdir(output, { recursive: true });
const outdir = path.join(output, 'build');
await buildExtension({ outdir });
// Grant the selected services in this isolated quality-check build. Permission
// prompts are exercised separately by the upgrade flow, not by this benchmark.
const testManifest = JSON.parse(await readFile(path.join(outdir, 'manifest.json'), 'utf8'));
testManifest.host_permissions.push(...testManifest.optional_host_permissions);
delete testManifest.optional_host_permissions;
await writeFile(path.join(outdir, 'manifest.json'), JSON.stringify(testManifest, null, 2) + '\n');
await build({ entryPoints: [path.join(projectRoot, 'src/src/translation.js')], outfile: path.join(outdir, 'translation-probe.js'), bundle: true, format: 'esm', target: 'firefox140', platform: 'browser' });
let driver = await startFirefox(outdir, { profile: path.join(output, 'firefox-profile') });
await driver.manage().setTimeouts({ script: 180000 });
const call = async (method, ...args) => driver.executeAsyncScript(`
  const [method,args,done]=arguments;
  import(browser.runtime.getURL('translation-probe.js')).then(api=>api[method](...args)).then(done,error=>done({error:{code:error.code,message:error.message}}));
`, method, args);
const cacheBytes = () => driver.executeAsyncScript(`
  const done=arguments[0];
  caches.open('lyrics-bergamot-models-v1').then(async cache=>Promise.all((await cache.keys()).map(key=>cache.match(key)))).then(responses=>done(responses.reduce((sum,response)=>sum+Number(response.headers.get('Content-Length')||0),0)));
`);
if (process.argv.includes('--fresh-models')) await driver.executeAsyncScript("const done=arguments[0];caches.delete('lyrics-bergamot-models-v1').then(done);");
const models = JSON.parse(await readFile(path.join(projectRoot, 'src/src/bergamot-models.json'), 'utf8'));
const report = { checkedAt: new Date().toISOString(), method: 'Real Firefox; identical unique lines per song; Portuguese target. Bergamot 0.4.9 with pinned CPU models, including the released Mozilla base-memory English-to-Portuguese model. MyMemory en/fr/es to pt-BR. No full-song context or LLM. Latencies include model loading and initial downloads, where applicable. The browser HTTP cache may satisfy model downloads. An existing comparison profile may already contain models.', models: Object.fromEntries(['enpt', 'fren', 'esen'].map(pair => [pair, models[pair]])), initialModelBytes: await cacheBytes(), songs: [] };
const checkpoint = () => writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
try {
  for (const song of songs) {
    const entry = { ...song, detectedSource: await call('detectSource', song.lyrics) };
    for (const engine of ['bergamot', 'mymemory']) {
      const started = performance.now();
      entry[engine] = { result: await call('translateAutomatic', song.lyrics, engine, song.source), milliseconds: Math.round(performance.now() - started) };
      assert.ok(!entry[engine].result.error, JSON.stringify({ title: song.title, engine, ...entry[engine] }));
      assert.equal(entry[engine].result.lines.length, song.lyrics.split('\n').length);
      console.log(`${song.title}: ${engine}, ${entry[engine].milliseconds} ms`);
    }
    report.songs.push(entry); await checkpoint();
  }
  report.downloadedModelBytes = await cacheBytes();
  // A new Firefox process proves that model data is persisted, not just held in memory.
  await driver.quit(); driver = null;
  driver = await startFirefox(outdir, { profile: path.join(output, 'firefox-profile') });
  await driver.manage().setTimeouts({ script: 180000 });
  report.modelBytesAfterRestart = await cacheBytes();
  assert.equal(report.modelBytesAfterRestart, report.downloadedModelBytes);
  await call('detectSource', 'An English sentence to initialize the comparison module.');
  await driver.setContext(firefox.Context.CHROME);
  await driver.executeScript('Services.io.manageOfflineStatus=false;Services.io.offline=true;');
  await driver.setContext(firefox.Context.CONTENT);
  try {
    const lyrics = 'And I shall hear, though soft you tread above me.';
    report.offlineAfterRestart = await call('translateAutomatic', lyrics, 'bergamot', 'en');
    await checkpoint();
    assert.equal(report.offlineAfterRestart.provider, 'bergamot', JSON.stringify(report.offlineAfterRestart));
    report.onlineServiceWhileOffline = await call('translateAutomatic', lyrics, 'mymemory', 'en');
    assert.ok(report.onlineServiceWhileOffline.error, 'The remote service must be unreachable while Firefox is offline.');
  } finally {
    await driver.setContext(firefox.Context.CHROME);
    await driver.executeScript('Services.io.offline=false;Services.io.manageOfflineStatus=true;');
    await driver.setContext(firefox.Context.CONTENT);
  }
  await checkpoint();
  const escape = text => String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bergamot / MyMemory comparison</title>
  <style>body{margin:0;background:#171819;color:#eceeec;font:15px/1.6 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:36px 24px}h1{font-size:28px;margin:0 0 12px}h2{font-size:20px;margin:0}p,small{color:#a3aaa4}section{border-top:1px solid #343836;padding:24px 0}table{width:100%;border-collapse:collapse;margin-top:16px;table-layout:fixed}th{text-align:left;color:#a3aaa4;font-size:12px;font-weight:500}td,th{padding:12px 16px 12px 0;vertical-align:top;border-bottom:1px solid #282c2a;overflow-wrap:anywhere}td:first-child{color:#a3aaa4}code{font-size:12px}.facts{display:flex;gap:24px;flex-wrap:wrap}.note{max-width:800px}@media(max-width:650px){main{padding:24px 14px}td,th{font-size:12px;padding-right:8px}}</style>
  <main><h1>Bergamot / MyMemory</h1><p class="note">Eight public-domain song excerpts, identical inputs, real requests and local inference in Firefox. Both engines translate each unique line separately; neither receives full-song context. No quality score is assigned automatically.</p>
  <div class="facts"><span>Checked: ${escape(report.checkedAt)}</span><span>Model cache: ${(report.downloadedModelBytes / 1e6).toFixed(1)} MB</span><span>Offline after restart: passed</span></div>
  <p class="note">Bergamot uses Mozilla’s released base-memory English-to-Portuguese model and compact source-to-English models for French and Spanish. MyMemory targets Brazilian Portuguese. Timings include model loading and any initial download; they are observations from this run, not a performance guarantee.</p>
  ${report.songs.map(song => `<section><h2>${escape(song.title)}</h2><small>Source: ${song.source} · automatically detected: ${escape(song.detectedSource)} · Bergamot: ${song.bergamot.milliseconds} ms · MyMemory: ${song.mymemory.milliseconds} ms</small><table><thead><tr><th>Original</th><th>Bergamot · local</th><th>MyMemory · online</th></tr></thead><tbody>${song.lyrics.split('\n').map((line, i) => `<tr><td>${escape(line)}</td><td>${escape(song.bergamot.result.lines[i])}</td><td>${escape(song.mymemory.result.lines[i])}</td></tr>`).join('')}</tbody></table></section>`).join('')}
  <section><h2>Offline check</h2><p>After closing and restarting Firefox, its network was disabled. Bergamot translated a new line using persisted models. MyMemory returned a connection error.</p><p>${escape(report.offlineAfterRestart.lines[0])}</p></section></main></html>`;
  await writeFile(path.join(output, 'comparison.html'), html);
  console.log(`Comparison saved: ${path.join(output, 'comparison.html')}`);
} finally { if (driver) await driver.quit(); }
