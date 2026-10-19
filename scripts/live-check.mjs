import assert from 'node:assert/strict';
import { By } from 'selenium-webdriver';
import { buildExtension } from './build.mjs';
import { startFirefox, openExtension } from './firefox.mjs';

await buildExtension();
const driver = await startFirefox('dist');
try {
  await driver.executeScript('return browser.runtime.sendMessage({type:"PREFERENCES",value:{locale:"en",translationTarget:"pt"}});');
  await openExtension(driver);
  const input = await driver.findElement(By.css('#search-input'));
  await input.sendKeys('Remeber the Time');
  await driver.wait(async () => (await driver.findElements(By.css('.song-open'))).length > 0, 20000, 'Public song discovery did not return results');
  const first = await driver.findElement(By.css('.song-open'));
  const title = await first.findElement(By.css('.song-title')).getText();
  const artist = await first.findElement(By.css('.song-artist')).getText();
  assert.equal(title.toLowerCase(), 'remember the time');
  assert.equal(artist, 'Michael Jackson');
  await first.click();
  await driver.wait(async () => (await driver.findElements(By.css('#lyrics .original'))).length > 0, 20000, 'Public lyrics lookup did not return content');
  const originalLines = (await driver.findElements(By.css('.original'))).length;
  const originalLength = await driver.executeScript('return document.getElementById("lyrics").textContent.length;');
  await driver.findElement(By.css('#translation-toggle')).click();
  await driver.wait(() => driver.executeScript('const r=document.querySelectorAll(".original").length;const t=document.querySelectorAll(".translation").length;return r>0&&r===t;'), 180000, 'Public line-by-line translation did not complete');
  const translationLines = (await driver.findElements(By.css('.translation'))).length;
  console.log(JSON.stringify({ browser: (await driver.getCapabilities()).get('browserVersion'),
    query: 'Remeber the Time', title, artist, originalLines, originalCharacters: originalLength,
    translationLines, translation: 'MyMemory / automatic / Portuguese', complete: translationLines === originalLines,
  }, null, 2));
} finally { await driver.quit(); }
