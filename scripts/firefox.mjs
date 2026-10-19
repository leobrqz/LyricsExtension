import { Builder } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const extensionId = 'lyrics-extension@leobrqz.github.io';
export const extensionUuid = '7c01b5d7-bc83-48d4-b0d6-7c6f472a786b';
export const extensionUrl = `moz-extension://${extensionUuid}/popup.html`;

export async function openExtension(driver) {
  await driver.setContext(firefox.Context.CONTENT);
  await driver.setContext(firefox.Context.CHROME);
  const url = await driver.executeScript('return WebExtensionPolicy.getByID(arguments[0]).getURL("popup.html");', extensionId);
  const previous = await driver.executeScript('const browser=gBrowser.selectedBrowser;const id=String(browser.browsingContext.currentWindowGlobal?.innerWindowId);browser.loadURI(Services.io.newURI(arguments[0]), {triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()});return id;', url);
  await driver.wait(() => driver.executeScript('return String(gBrowser.selectedBrowser.browsingContext.currentWindowGlobal?.innerWindowId)!==arguments[0] && gBrowser.selectedBrowser.currentURI.spec===arguments[1];', previous, url), 10000);
  await driver.setContext(firefox.Context.CONTENT);
  await driver.wait(async () => (await driver.findElements({ css: '#nav-search' })).length > 0, 15000, 'Extension did not initialize');
  driver.lyricsUrl = url;
  return url;
}

export async function startFirefox(extensionPath, { profile, headless = true } = {}) {
  const options = new firefox.Options();
  const candidates = [process.env.FIREFOX_BINARY, 'C:/Program Files/Mozilla Firefox/firefox.exe', 'C:/Program Files (x86)/Mozilla Firefox/firefox.exe', '/Applications/Firefox.app/Contents/MacOS/firefox', '/usr/bin/firefox'].filter(Boolean);
  const binary = candidates.find(candidate => existsSync(candidate));
  if (binary) options.setBinary(binary);
  if (headless) options.addArguments('-headless');
  const preferences = {
    'extensions.webextensions.uuids': JSON.stringify({ [extensionId]: extensionUuid }),
    'browser.shell.checkDefaultBrowser': false,
    'browser.startup.homepage_override.mstone': 'ignore',
    'datareporting.policy.dataSubmissionEnabled': false,
    'toolkit.telemetry.reportingpolicy.firstRun': false,
  };
  for (const [key, value] of Object.entries(preferences)) options.setPreference(key, value);
  if (profile) {
    await mkdir(profile, { recursive: true });
    await writeFile(path.join(profile, 'user.js'), Object.entries(preferences).map(([key, value]) => `user_pref(${JSON.stringify(key)}, ${JSON.stringify(value)});`).join('\n'));
    options.addArguments('-profile', path.resolve(profile));
  }
  const service = new firefox.ServiceBuilder().addArguments('--allow-system-access');
  const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).setFirefoxService(service).build();
  try {
    await driver.installWebExtension(path.resolve(extensionPath), { permanent: false });
    await driver.manage().window().setRect({ width: 460, height: 770 });
    await openExtension(driver);
    return driver;
  } catch (error) { await driver.quit(); throw error; }
}
