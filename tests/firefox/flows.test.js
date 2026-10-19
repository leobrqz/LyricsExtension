import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { By, Key } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildExtension, projectRoot } from '../../scripts/build.mjs';
import { startFirefox, openExtension } from '../../scripts/firefox.mjs';
import { fixtureServer, sampleLyrics } from '../fixtures/server.js';

let driver;
let server;
const output = path.join(projectRoot, '.test-build');
const profile = path.join(projectRoot, '.test-profile');
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const element = css => driver.findElement(By.css(css));
const elements = css => driver.findElements(By.css(css));
const waitFor = async css => driver.wait(async () => (await elements(css)).length > 0, 9000, `Missing element ${css}`);
const message = (type, payload = {}) => driver.executeScript('return browser.runtime.sendMessage(arguments[0]);', { type, ...payload });

before(async () => {
  server = await fixtureServer();
  await buildExtension({ outdir: output, apiBase: server.base, translationBase: server.base });
  driver = await startFirefox(output, { profile });
  await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true });
});

after(async () => { if (driver) await driver.quit(); if (server) await server.close(); });

beforeEach(async () => {
  server.setUnavailable(false); server.setTranslationFailure(null);
  await driver.setContext(firefox.Context.CONTENT);
  const handles = await driver.getAllWindowHandles();
  for (const handle of handles.slice(1)) { await driver.switchTo().window(handle); await driver.close(); }
  await driver.switchTo().window(handles[0]);
  await openExtension(driver);
  const snapshot = await message('BOOT');
  for (const favorite of snapshot.favorites) await message('FAVORITE', { song: favorite.song, enabled: false });
  await message('PREFERENCES', { value: { locale: 'pt-BR', translationTarget: 'pt' } });
  await (await element('#nav-favorites')).click();
  await driver.executeScript('const input=document.getElementById("search-input");input.value="";input.dispatchEvent(new Event("input",{bubbles:true}));');
  await (await element('#nav-search')).click();
  await driver.executeScript('const input=document.getElementById("search-input");input.value="";input.dispatchEvent(new Event("input",{bubbles:true}));');
  await openExtension(driver);
  server.requests.length = 0;
});

async function search(query) {
  await (await element('#search-input')).clear();
  await (await element('#search-input')).sendKeys(query);
}

async function readSong() {
  await search('Window'); await waitFor('.song-open');
  await (await element('.song-open')).click(); await waitFor('#lyrics .original');
}

test('title-only search updates without Enter, opens originals, and preserves the query on return', async () => {
  await search('Window'); await waitFor('.song-open');
  assert.equal((await elements('.song-open')).length, 3);
  assert.equal((await elements('#lyrics')).length, 0);
  assert.ok(server.requests.some(url => url.includes('/suggest/Window')));
  await writeFile('artifacts/search.png', await driver.takeScreenshot(), 'base64');
  await (await element('.song-open')).click(); await waitFor('#lyrics .original');
  assert.equal(await (await element('#song-title')).getText(), 'Window Songs');
  assert.equal((await elements('.translation')).length, 0);
  assert.equal((await elements('.original')).length, sampleLyrics.split('\n').filter(Boolean).length);
  await (await element('#reader-back')).click();
  assert.equal(await (await element('#search-input')).getAttribute('value'), 'Window');
  assert.equal((await elements('.song-open')).length, 3);
});

test('latest query wins when an older request finishes later', async () => {
  await search('older');
  await driver.wait(() => server.requests.some(url => url.includes('/suggest/older')), 5000);
  await search('newer'); await waitFor('.song-open');
  await pause(1050);
  assert.equal(await (await element('.song-title')).getText(), 'Newer Result');
  assert.equal(await (await element('#search-input')).getAttribute('value'), 'newer');
});

test('composing text with an input method is preserved until the composition finishes', async () => {
  await driver.executeScript('const input=document.getElementById("search-input");input.dispatchEvent(new CompositionEvent("compositionstart",{bubbles:true}));input.value="夜の歌";input.dispatchEvent(new InputEvent("input",{bubbles:true,isComposing:true}));');
  await pause(380);
  assert.equal(server.requests.length, 0);
  assert.equal(await (await element('#search-input')).getAttribute('value'), '夜の歌');
  await driver.executeScript('document.getElementById("search-input").dispatchEvent(new CompositionEvent("compositionend",{bubbles:true}));');
  await waitFor('.song-open');
  assert.equal(await (await element('#search-input')).getAttribute('value'), '夜の歌');
});

test('empty search, failed service, and missing lyrics have distinct recoverable states', async () => {
  await search('nothing'); await waitFor('.empty h2');
  assert.match(await (await element('.empty h2')).getText(), /Nenhuma música/);
  await search('offline'); await waitFor('.empty h2');
  assert.match(await (await element('.empty h2')).getText(), /não respondeu/);
  assert.ok((await element('.empty button')).isEnabled());
  await search('missing'); await waitFor('.song-open');
  await (await element('.song-open')).click(); await waitFor('#retry-lyrics');
  assert.match(await (await element('.empty h2')).getText(), /letra/);
  await (await element('#reader-back')).click();
  assert.equal(await (await element('#search-input')).getAttribute('value'), 'missing');
});

test('lyrics and cached translations remain readable from favorites without the content services', async () => {
  await readSong();
  await (await element('#favorite-toggle')).click();
  await driver.wait(async () => (await message('BOOT')).favorites.length === 1, 5000);
  await (await element('#translation-toggle')).click();
  const nonemptyLines = sampleLyrics.split('\n').filter(Boolean).length;
  await driver.wait(async () => (await elements('.translation')).length === nonemptyLines, 9000);
  await driver.wait(async () => (await message('BOOT')).favorites[0].reader.translations['en|pt']?.complete, 5000);
  const first = await element('[data-line-index="0"]');
  assert.equal(await first.findElement(By.css('.original')).getText(), 'The rain is singing at my window');
  assert.equal(await first.findElement(By.css('.translation')).getText(), 'A chuva canta na minha janela');
  assert.equal((await elements('[data-line-index="4"] .translation')).length, 0);
  const translationQueries = server.requests.filter(url => url.startsWith('/get?'));
  assert.equal(translationQueries.length, new Set(sampleLyrics.split('\n').filter(Boolean)).size);
  await writeFile('artifacts/translation.png', await driver.takeScreenshot(), 'base64');
  await (await element('#nav-favorites')).click();
  await (await element('#search-input')).sendKeys('night wind');
  assert.equal((await elements('.song-open')).length, 1);
  server.setUnavailable(true);
  const requestCount = server.requests.length;
  await (await element('.song-open')).click(); await waitFor('#lyrics .original');
  assert.equal((await elements('.translation')).length, 0, 'new openings start with the original');
  await (await element('#translation-toggle')).click();
  await driver.wait(async () => (await elements('.translation')).length === nonemptyLines, 5000);
  assert.equal(server.requests.length, requestCount);
  await (await element('#reader-back')).click();
  assert.equal(await (await element('#search-input')).getAttribute('value'), 'night wind');
});

test('favorite removal is reversible and favorites filtering never searches the public catalog', async () => {
  await readSong(); await (await element('#favorite-toggle')).click();
  await (await element('#nav-favorites')).click();
  const count = server.requests.length;
  await (await element('#search-input')).sendKeys('not here');
  assert.equal((await elements('.song-open')).length, 0);
  assert.match(await (await element('.empty h2')).getText(), /Nenhum favorito/);
  assert.equal(server.requests.length, count);
  await (await element('#clear-search')).click();
  await (await element('.song-row>.icon-button')).click();
  await driver.wait(async () => (await elements('.song-open')).length === 0, 5000);
  await (await element('#toast button')).click();
  await waitFor('.song-open');
  assert.equal((await message('BOOT')).favorites.length, 1);
});

test('translation quota errors preserve the complete original and offer recovery', async () => {
  await readSong(); server.setTranslationFailure('quota');
  await (await element('#translation-toggle')).click();
  await waitFor('#retry-translation');
  assert.match(await (await element('#translation-status')).getText(), /limite diário/);
  assert.equal((await elements('.original')).length, sampleLyrics.split('\n').filter(Boolean).length);
  server.setTranslationFailure(null);
  await (await element('#retry-translation')).click();
  await driver.wait(async () => (await elements('.translation')).length === sampleLyrics.split('\n').filter(Boolean).length, 9000);
});

test('same-language translation requests are explained without contacting the translator', async () => {
  await readSong(); await (await element('#translation-toggle')).click();
  await driver.wait(async () => (await elements('.translation')).length === sampleLyrics.split('\n').filter(Boolean).length, 9000);
  const count = server.requests.filter(url => url.startsWith('/get?')).length;
  await driver.executeScript('const select=document.getElementById("target-language");select.value="en";select.dispatchEvent(new Event("change",{bubbles:true}));');
  await driver.wait(() => driver.executeScript('return document.getElementById("translation-status")?.textContent.includes("já está");'), 5000);
  assert.equal((await elements('.translation')).length, 0);
  assert.equal(server.requests.filter(url => url.startsWith('/get?')).length, count);
});

test('interface language changes persist and leave the original and favorites intact', async () => {
  await readSong(); await (await element('#favorite-toggle')).click();
  await (await element('#settings-button')).click();
  await driver.executeScript('const select=document.getElementById("interface-language");select.value="en";select.dispatchEvent(new Event("change",{bubbles:true}));');
  await driver.wait(() => driver.executeScript('return document.getElementById("nav-search")?.textContent.includes("Search");'), 5000);
  await openExtension(driver);
  assert.equal(await driver.executeScript('return document.documentElement.lang;'), 'en');
  assert.equal((await message('BOOT')).favorites.length, 1);
  await (await element('#nav-favorites')).click(); await (await element('.song-open')).click(); await waitFor('#lyrics .original');
  assert.equal(await (await element('.original')).getText(), sampleLyrics.split('\n')[0]);
});

test('untrusted catalog text is displayed as text rather than executable markup', async () => {
  await search('markup'); await waitFor('.song-open');
  assert.match(await (await element('.song-title')).getText(), /<img/);
  assert.equal((await elements('img')).length, 0);
  assert.equal(await driver.executeScript('return Boolean(window.injected);'), false);
});

test('reopening the extension retains the current reader and its scroll position', async () => {
  await readSong();
  await driver.executeScript('document.getElementById("content").scrollTop=220;');
  await driver.wait(async () => (await message('BOOT')).session.readerScroll >= 200, 5000);
  await openExtension(driver); await waitFor('#lyrics .original');
  assert.ok(await driver.executeScript('return document.getElementById("content").scrollTop;') >= 200);
});

test('keyboard navigation has visible focus and reduced-motion preference disables animations', async () => {
  await (await element('#search-input')).sendKeys(Key.TAB);
  assert.equal(await driver.executeScript('return document.activeElement.tagName;'), 'BUTTON');
  const missingNames = await driver.executeScript('return [...document.querySelectorAll("button")].filter(b=>!b.textContent.trim()&&!b.getAttribute("aria-label")).length;');
  assert.equal(missingNames, 0);
  await driver.setContext(firefox.Context.CHROME);
  await driver.executeScript('Services.prefs.setIntPref("ui.prefersReducedMotion",1);');
  await driver.setContext(firefox.Context.CONTENT);
  await driver.wait(() => driver.executeScript('return matchMedia("(prefers-reduced-motion: reduce)").matches;'), 5000, 'Firefox did not apply the reduced-motion preference');
  await driver.wait(() => driver.executeScript('return getComputedStyle(document.querySelector(".view")).animationName === "none";'), 5000);
  await driver.setContext(firefox.Context.CHROME);
  await driver.executeScript('Services.prefs.clearUserPref("ui.prefersReducedMotion");');
  await driver.setContext(firefox.Context.CONTENT);
});

test('real Firefox selection menu starts a search and retains a matching YouTube origin', async () => {
  await driver.get(`${server.base}/page`);
  const link = await element('#song-link');
  await driver.executeScript('const range=document.createRange();range.selectNodeContents(arguments[0]);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);', link);
  await driver.actions().contextClick(link).perform();
  await driver.setContext(firefox.Context.CHROME);
  await driver.wait(() => driver.executeScript('return [...document.querySelectorAll("#contentAreaContextMenu menuitem")].some(n=>(n.getAttribute("label")||"").startsWith("Achar letras"));'), 5000);
  const menuLabel = await driver.executeScript('const item=[...document.querySelectorAll("#contentAreaContextMenu menuitem")].find(n=>(n.getAttribute("label")||"").startsWith("Achar letras"));const label=item.getAttribute("label");item.doCommand();document.getElementById("contentAreaContextMenu").hidePopup();return label;');
  assert.match(menuLabel, /Window Songs/);
  await driver.setContext(firefox.Context.CONTENT);
  await openExtension(driver); await waitFor('#lyrics .original');
  assert.equal(await (await element('#youtube-button')).getText(), 'Abrir no YouTube');
  assert.equal((await message('BOOT')).session.reader.song.videoUrl, 'https://www.youtube.com/watch?v=AbCdEfGhI12');
  await (await element('#reader-back')).click();
  await search('Window'); await waitFor('.song-open');
  await (await elements('.song-open'))[1].click(); await waitFor('#lyrics .original');
  assert.equal(await (await element('#youtube-button')).getText(), 'Buscar no YouTube');
});

test('the Firefox toolbar button opens the actual extension popup at a usable size', async () => {
  await driver.manage().window().setRect({ width: 1100, height: 850 });
  await driver.setContext(firefox.Context.CHROME);
  const widgetId = 'lyrics-extension_leobrqz_github_io-browser-action';
  await driver.executeScript('CustomizableUI.addWidgetToArea(arguments[0],CustomizableUI.AREA_NAVBAR);', widgetId);
  await (await driver.findElement(By.id('lyrics-extension_leobrqz_github_io-BAP'))).click();
  await driver.wait(() => driver.executeScript('return [...document.querySelectorAll("panel")].some(panel=>panel.state==="open"&&panel.querySelector(".webextension-popup-browser"));'), 5000);
  await driver.wait(() => driver.executeScript('const p=[...document.querySelectorAll("panel")].find(p=>p.state==="open"&&p.querySelector(".webextension-popup-browser"));const r=p?.querySelector(".webextension-popup-browser")?.getBoundingClientRect();return r?.width>=320&&r?.height>=450;'), 5000, 'Popup did not reach its expected size').catch(async error => {
    const detail = await driver.executeScript('return [...document.querySelectorAll(".webextension-popup-browser")].map(b=>({rect:b.getBoundingClientRect().toJSON(),style:b.getAttribute("style"),url:b.currentURI.spec,panel:b.closest("panel")?.state,html:b.outerHTML.slice(0,1000)}));');
    throw new Error(`${error.message}: ${JSON.stringify(detail)}`);
  });
  const size = await driver.executeScript('const panel=[...document.querySelectorAll("panel")].find(panel=>panel.state==="open"&&panel.querySelector(".webextension-popup-browser"));const b=panel.querySelector(".webextension-popup-browser");const r=b.getBoundingClientRect();return {width:r.width,height:r.height,url:b.currentURI.spec};');
  assert.ok(size.width >= 320, JSON.stringify(size));
  assert.ok(size.height >= 450, JSON.stringify(size));
  assert.match(size.url, /popup.html/);
  await writeFile('artifacts/popup-metrics.json', JSON.stringify(size, null, 2) + '\n');
  await writeFile('artifacts/toolbar-popup.png', await driver.takeScreenshot(), 'base64');
  await driver.executeScript('for(const panel of document.querySelectorAll("panel"))if(panel.state==="open")panel.hidePopup();');
  await driver.setContext(firefox.Context.CONTENT);
  await driver.manage().window().setRect({ width: 460, height: 770 });
});

test('favorites persist after an actual Firefox shutdown and restart', async () => {
  await readSong(); await (await element('#favorite-toggle')).click();
  await driver.wait(async () => (await message('BOOT')).favorites.length === 1, 5000);
  await driver.quit(); driver = null;
  driver = await startFirefox(output, { profile });
  const snapshot = await message('BOOT');
  assert.equal(snapshot.favorites.length, 1);
  assert.equal(snapshot.session.query, '', 'session-only context is cleared on a browser restart');
  await (await element('#nav-favorites')).click(); await (await element('.song-open')).click(); await waitFor('#lyrics .original');
});
