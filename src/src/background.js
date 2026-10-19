import { Repository } from './repository.js';
import { videoOrigin } from './model.js';
import { t } from './i18n.js';

const repository = new Repository(browser.storage, browser.i18n.getUILanguage());
const ready = repository.init();
let contextTask = ready;
let readerWindow;
let menuQueue = Promise.resolve();

function updateMenu() {
  menuQueue = menuQueue.catch(() => {}).then(async () => {
    await browser.menus.removeAll();
    browser.menus.create({ id: 'find-lyrics', contexts: ['selection'], title: t(repository.preferences.locale, 'contextMenu') });
  });
  return menuQueue;
}

ready.then(updateMenu).catch(console.error);
browser.runtime.onInstalled.addListener(() => ready.then(updateMenu).catch(console.error));

async function openReaderWindow() {
  if (readerWindow) {
    try { await browser.windows.update(readerWindow, { focused: true }); return; }
    catch { readerWindow = null; }
  }
  const window = await browser.windows.create({ url: browser.runtime.getURL('popup.html?standalone=1'), type: 'popup', width: 452, height: 720 });
  readerWindow = window.id;
}

browser.windows.onRemoved.addListener(id => { if (readerWindow === id) readerWindow = null; });

browser.menus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'find-lyrics') return;
  const query = String(info.selectionText || '').replace(/\s+/g, ' ').trim();
  if (!query) return;
  contextTask = ready.then(() => repository.startContext(query, videoOrigin(info, tab)));
  // Open from the input event. BOOT waits for contextTask so the selection cannot be lost.
  browser.action.openPopup({ windowId: tab.windowId }).catch(openReaderWindow).catch(console.error);
  contextTask.then(() => browser.runtime.sendMessage({ type: 'CONTEXT_CHANGED' }).catch(() => {})).catch(console.error);
});

browser.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== browser.runtime.id || !message || message.type === 'CONTEXT_CHANGED') return undefined;
  return (async () => {
    await ready;
    switch (message.type) {
      case 'BOOT': await contextTask; return repository.snapshot();
      case 'SESSION': return repository.patchSession(message.id, message.patch);
      case 'PREFERENCES': {
        const result = await repository.updatePreferences(message.value);
        await updateMenu();
        return result;
      }
      case 'FAVORITE': return repository.setFavorite(message.song, message.reader, message.enabled, message.savedAt);
      case 'CACHE_FAVORITE': await repository.updateFavoriteReader(message.reader); return true;
      default: return undefined;
    }
  })();
});
