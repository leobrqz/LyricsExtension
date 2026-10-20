import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { By } from 'selenium-webdriver';
import { buildExtension } from './build.mjs';
import { startFirefox, openExtension } from './firefox.mjs';

const songs = [
  ['Michael Jackson', 'Billie Jean', 'michael-jackson/63736/', true],
  ['Fatboy Slim', 'Michael Jackson', 'fatboy-slim/194195/', true],
  ['Adele', 'Hello', 'adele/hello/', true],
  ['Galinha Pintadinha', 'Dona Aranha', 'galinha-pintadinha/dona-aranha/', false],
];

await buildExtension();
const driver = await startFirefox('dist');
try {
  await driver.executeScript('return browser.runtime.sendMessage({type:"PREFERENCES",value:{locale:"en"}});');
  const results = [];
  for (const [artist, title, sourcePath, hasTranslation] of songs) {
    await openExtension(driver);
    await driver.findElement(By.id('nav-search')).click();
    const input = await driver.findElement(By.id('search-input'));
    await input.clear();
    await input.sendKeys(`${artist} ${title}`);
    let match;
    await driver.wait(async () => {
      for (const row of await driver.findElements(By.css('.song-open'))) {
        const rowArtist = await row.findElement(By.css('.song-artist')).getText();
        const rowTitle = await row.findElement(By.css('.song-title')).getText();
        if (rowArtist.toLowerCase() === artist.toLowerCase() && rowTitle.toLowerCase() === title.toLowerCase()) { match = row; return true; }
      }
      return false;
    }, 20000, `Song discovery did not find ${artist} / ${title}`);
    await match.click();
    await driver.wait(async () => (await driver.findElements(By.css('#lyrics .original'))).length > 0, 25000, `No lyrics for ${artist} / ${title}`);
    await driver.findElement(By.id('translation-toggle')).click();
    await driver.wait(() => driver.executeScript('return document.querySelectorAll("#lyrics .translation").length > 0 || Boolean(document.getElementById("retry-translation"));'), 15000);
    const reader = await driver.executeScript('return browser.runtime.sendMessage({type:"BOOT"}).then(s => s.session.reader);');
    assert.equal(reader.provider.name, 'letras', `Expected direct Letras lyrics for ${title}`);
    assert.equal(reader.provider.url, 'https://www.letras.mus.br/' + sourcePath, `Wrong song version for ${title}`);
    const originalLines = reader.lyrics.split('\n').filter(line => line.trim()).length;
    const translationLines = reader.translation?.lines.filter(Boolean).length || 0;
    if (hasTranslation) {
      assert.equal(reader.translationError, null, `${title}: ${reader.translationError}`);
      assert.equal(reader.translation.language, 'pt');
      assert.equal(translationLines, originalLines);
      assert.equal((await driver.findElements(By.css('.translation'))).length, originalLines);
    } else {
      assert.equal(reader.translation, null);
      assert.equal(reader.translationError, 'translationNotFound');
      assert.equal((await driver.findElements(By.css('.translation'))).length, 0);
    }
    const sourceLabel = await driver.findElement(By.id('lyrics-source')).getText();
    if (title === 'Billie Jean') await writeFile('artifacts/billie-jean-source.png', await driver.findElement(By.css('.reader-heading')).takeScreenshot(), 'base64');
    results.push({ artist, title, source: reader.provider.url, sourceLabel, originalLines, translationLines,
      translation: reader.translation?.url || null, missingTranslation: !hasTranslation });
  }
  const report = { checkedAt: new Date().toISOString(), browser: (await driver.getCapabilities()).get('browserVersion'), results };
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/letras-live-check.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await driver.quit(); }
