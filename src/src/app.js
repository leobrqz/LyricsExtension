import { el, icon } from './dom.js';
import { t, initialPreferences, languageName, translationLanguages } from './i18n.js';
import { searchSongs, getLyrics } from './api.js';
import { filterFavorites, lyricLines, confidentMatch, matchedVideo, youtubeDestination, youtubeVideoUrl } from './model.js';
import { detectLanguage, translateLines } from './translation.js';

const root = document.getElementById('app');
const toastElement = document.getElementById('toast');
let state;
let searchStatus = 'idle';
let searchError = '';
let slowSearch = false;
let searchController;
let lyricsController;
let translationController;
let searchTimer;
let saveTimer;
let toastTimer;
let bootGeneration = 0;
let lastView;
let settingsFrom = 'search';

if (new URLSearchParams(location.search).has('standalone')) document.documentElement.classList.add('standalone');
const rpc = (type, payload = {}) => browser.runtime.sendMessage({ type, ...payload });
const text = (key, values) => t(state?.preferences.locale || initialPreferences(navigator.language).locale, key, values);
const main = () => document.getElementById('content');
const isFavorite = song => state.favorites.some(item => item.song.key === song.key);

function button(label, handler, { name, className = 'button', id, pressed, disabled = false } = {}) {
  return el('button', { type: 'button', className, id, title: label, 'aria-label': label,
    'aria-pressed': pressed === undefined ? undefined : String(pressed), disabled, onClick: handler },
  name && icon(name, name === 'star' && pressed), className.includes('icon-button') ? null : label);
}

function externalLink(label, href, className = 'link-row') {
  return el('a', { href, target: '_blank', rel: 'noopener noreferrer', className }, label, icon('external'));
}

function toast(key, undo) {
  clearTimeout(toastTimer);
  toastElement.replaceChildren(el('span', {}, text(key)));
  if (undo) toastElement.append(button(text('undo'), async () => {
    toastElement.hidden = true;
    try { await undo(); } catch { toast('storageError'); }
  }));
  toastElement.hidden = false;
  toastTimer = setTimeout(() => { toastElement.hidden = true; }, undo ? 7000 : 3500);
}

async function saveSession() {
  if (!state) return;
  return rpc('SESSION', { id: state.session.id, patch: state.session });
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveSession().catch(() => toast('storageError')), 180);
}

function captureScroll() {
  if (!state || !main()) return;
  const key = `${state.session.view}Scroll`;
  if (key in state.session) state.session[key] = main().scrollTop;
}

function abortRequests() {
  clearTimeout(searchTimer);
  searchController?.abort(); lyricsController?.abort(); translationController?.abort();
  if (state?.session.reader) state.session.reader.translating = false;
}

function readingAnchor() {
  if (!main() || lastView !== 'reader' || main().scrollTop < 8) return null;
  const top = main().getBoundingClientRect().top;
  const line = [...document.querySelectorAll('[data-line-index]')].find(node => node.getBoundingClientRect().bottom >= top);
  return line ? { index: line.dataset.lineIndex, offset: line.getBoundingClientRect().top - top } : null;
}

function restoreAnchor(anchor) {
  if (!anchor || !main()) return;
  const line = document.querySelector(`[data-line-index="${anchor.index}"]`);
  if (line) main().scrollTop += line.getBoundingClientRect().top - main().getBoundingClientRect().top - anchor.offset;
}

function render({ focus = false, scroll } = {}) {
  const active = document.activeElement;
  const focusId = active?.id;
  const selection = active instanceof HTMLInputElement ? [active.selectionStart, active.selectionEnd] : null;
  const anchor = state.session.view === 'reader' && lastView === 'reader' ? readingAnchor() : null;
  const previousScroll = main()?.scrollTop || 0;
  document.documentElement.lang = state.preferences.locale;
  root.setAttribute('aria-busy', 'false');
  const header = el('header', { className: 'topbar' },
    el('button', { className: 'brand', type: 'button', 'aria-label': `Lyrics · ${text('search')}`, onClick: () => navigate('search') }, icon('wave'), 'lyrics'),
    button(text('settings'), () => navigate('settings'), { name: 'settings', className: `icon-button ${state.session.view === 'settings' ? 'active' : ''}`, id: 'settings-button' }));
  const content = el('main', { id: 'content', tabindex: '-1', 'aria-label': text(state.session.view === 'reader' ? 'lyricsLabel' : state.session.view), onScroll: () => { captureScroll(); scheduleSave(); } });
  content.append(state.session.view === 'reader' ? renderReader() : state.session.view === 'favorites' ? renderFavorites() : state.session.view === 'settings' ? renderSettings() : renderSearch());
  if (lastView === state.session.view) content.firstElementChild.style.animation = 'none';
  const activeNav = state.session.view === 'reader' ? state.session.reader?.from : state.session.view;
  const nav = el('nav', { className: 'bottom-nav', 'aria-label': 'Lyrics' },
    navButton('search', 'search', activeNav), navButton('favorites', 'star', activeNav));
  root.replaceChildren(header, content, nav, toastElement);
  const desiredScroll = scroll ?? (lastView === state.session.view ? previousScroll : state.session[`${state.session.view}Scroll`] || 0);
  content.scrollTop = desiredScroll;
  if (scroll === undefined) restoreAnchor(anchor);
  lastView = state.session.view;
  if (focusId) {
    const replacement = document.getElementById(focusId);
    replacement?.focus({ preventScroll: true });
    if (selection && replacement instanceof HTMLInputElement) replacement.setSelectionRange(...selection);
  } else if (focus) document.querySelector('input')?.focus({ preventScroll: true });
}

function navButton(view, name, active) {
  const node = button(text(view), () => navigate(view), { name, className: `nav-button ${active === view ? 'selected' : ''}`, id: `nav-${view}` });
  if (active === view) node.setAttribute('aria-current', 'page');
  if (view === 'favorites' && state.favorites.length) node.append(el('span', { className: 'badge', 'aria-hidden': 'true' }, state.favorites.length));
  return node;
}

function navigate(view) {
  if (state.session.view === view) return;
  captureScroll();
  if (view === 'settings') settingsFrom = state.session.view;
  abortRequests();
  state.session.view = view;
  scheduleSave();
  render({ focus: view !== 'reader' });
  if (view === 'search' && state.session.query.trim() && !state.session.results.length) runSearch();
  if (view === 'reader' && state.session.reader?.translationVisible) startTranslation();
}

function searchField(value, label, placeholder, handler) {
  let composing = false;
  const input = el('input', { id: 'search-input', type: 'text', value, placeholder, 'aria-label': label,
    autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false',
    onCompositionStart: () => { composing = true; clearTimeout(searchTimer); searchController?.abort(); },
    onCompositionEnd: event => { composing = false; handler(event.target.value); },
    onInput: event => { if (!composing && !event.isComposing) handler(event.target.value); } });
  const clear = value ? button(text('clear'), () => { handler(''); document.getElementById('search-input')?.focus(); }, { name: 'close', className: 'icon-button', id: 'clear-search' }) : el('span', { className: 'clear-placeholder' });
  return el('div', { className: 'search-box' }, icon('search'), input, clear);
}

function intro(title, description) {
  return el('div', { className: 'intro' }, el('h1', {}, title), el('p', {}, description));
}

function empty(title, description, name = 'wave', action) {
  return el('section', { className: 'empty', role: 'status' },
    el('div', { className: 'empty-symbol' }, icon(name)), el('h2', {}, title), el('p', {}, description), action);
}

function loading(label, skeleton = false) {
  return el('div', {}, el('div', { className: 'loading', role: 'status' }, el('span', { className: 'spinner', 'aria-hidden': 'true' }), label),
    skeleton && el('div', { className: 'skeleton', 'aria-hidden': 'true' }, Array.from({ length: 6 }, () => el('span'))));
}

function renderSearch() {
  const query = state.session.query;
  const view = el('section', { className: `view ${!query.trim() ? 'search-idle' : ''}` },
    intro(text('welcome'), text('welcomeText')),
    searchField(query, text('searchLabel'), text('searchPlaceholder'), onSearchInput));
  if (!query.trim()) {
    view.append(empty(text('ready'), text('keyboardHint')));
  } else if (searchStatus === 'loading') {
    view.append(loading(text(slowSearch ? 'slow' : 'searching'), true));
  } else if (searchStatus === 'error') {
    view.append(empty(text('searchError'), text(searchError === 'timeout' ? 'timeout' : 'unavailable'), 'alert', button(text('retry'), runSearch, { name: 'refresh' })));
  } else if (state.session.results.length) {
    view.append(listHeading(text('results'), state.session.results.length), songList(state.session.results));
  } else if (searchStatus === 'ready') {
    view.append(empty(text('noResults'), text('noResultsText'), 'search'));
  }
  return view;
}

function onSearchInput(value) {
  searchController?.abort();
  clearTimeout(searchTimer);
  state.session.query = value;
  state.session.results = [];
  state.session.origin = null;
  state.session.autoOpen = false;
  state.session.searchScroll = 0;
  searchStatus = value.trim() ? 'loading' : 'idle';
  slowSearch = false;
  scheduleSave();
  render({ scroll: 0 });
  if (value.trim()) searchTimer = setTimeout(runSearch, 300);
}

async function runSearch() {
  const query = state.session.query.trim();
  if (!query) return;
  searchController?.abort();
  const controller = new AbortController();
  searchController = controller;
  const sessionId = state.session.id;
  searchStatus = 'loading'; slowSearch = false;
  render();
  const slowTimer = setTimeout(() => {
    if (searchController === controller && searchStatus === 'loading') { slowSearch = true; render(); }
  }, 4500);
  try {
    const results = await searchSongs(query, { signal: controller.signal });
    if (controller.signal.aborted || state.session.id !== sessionId || state.session.query.trim() !== query) return;
    state.session.results = results;
    searchStatus = 'ready';
    await saveSession();
    if (state.session.autoOpen && confidentMatch(results, query)) {
      state.session.autoOpen = false;
      await openSong(results[0], 'search');
    } else { state.session.autoOpen = false; render(); }
  } catch (error) {
    if (error.name === 'AbortError' || controller.signal.aborted) return;
    searchStatus = 'error'; searchError = error.code;
    render();
  } finally { clearTimeout(slowTimer); }
}

function listHeading(label, count) {
  return el('div', { className: 'list-heading', role: 'status' }, el('h2', { className: 'eyebrow' }, label), el('span', { className: 'count' }, count));
}

function songList(songs, favorites = false) {
  return el('div', { className: 'song-list' }, songs.map(song => {
    const duration = song.duration ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}` : '';
    const row = el('article', { className: 'song-row' }, el('button', { type: 'button', className: 'song-open', 'data-song-key': song.key, onClick: () => openSong(song, favorites ? 'favorites' : 'search') },
      el('span', { className: 'song-symbol' }, icon('note')),
      el('span', { className: 'song-info' }, el('span', { className: 'song-title' }, song.title), el('span', { className: 'song-artist' }, song.artist)),
      duration && el('span', { className: 'song-duration' }, duration), !favorites && icon('arrow')));
    if (favorites) row.append(button(`${text('removeFavorite')} · ${song.title}`, () => changeFavorite(song, null, false), { name: 'star', className: 'icon-button active', pressed: true }));
    return row;
  }));
}

function renderFavorites() {
  const filtered = filterFavorites(state.favorites, state.session.favoritesQuery);
  const view = el('section', { className: 'view' }, intro(text('favoriteTitle'), text('favoriteSubtitle')),
    searchField(state.session.favoritesQuery, text('favoritesPlaceholder'), text('favoritesPlaceholder'), value => {
      state.session.favoritesQuery = value; state.session.favoritesScroll = 0; scheduleSave(); render({ scroll: 0 });
    }));
  if (!state.favorites.length) view.append(empty(text('emptyFavorites'), text('emptyFavoritesText'), 'star'));
  else if (!filtered.length) view.append(empty(text('emptyFilter'), text('emptyFilterText'), 'search', button(text('searchAll'), () => {
    const query = state.session.favoritesQuery;
    navigate('search'); onSearchInput(query);
  }, { name: 'search' })));
  else view.append(listHeading(text('favorites'), filtered.length), songList(filtered.map(item => item.song), true));
  return view;
}

async function openSong(song, from, { refresh = false } = {}) {
  captureScroll(); abortRequests();
  const cached = !refresh && state.favorites.find(item => item.song.key === song.key)?.reader;
  const videoUrl = (from === 'search' && matchedVideo(song, state.session.origin)) || song.videoUrl || cached?.song.videoUrl;
  const reader = cached?.lyrics ? { ...structuredClone(cached), from, song: { ...song, videoUrl }, translationVisible: false, target: state.preferences.translationTarget, cached: true }
    : { song: { ...song, videoUrl }, from, lyrics: '', source: '', target: state.preferences.translationTarget, translationVisible: false, translations: {}, status: 'loading', cached: false };
  state.session.reader = reader;
  state.session.view = 'reader'; state.session.readerScroll = 0;
  render({ scroll: 0 });
  scheduleSave();
  if (reader.lyrics) { reader.status = 'ready'; return; }
  const controller = new AbortController(); lyricsController = controller;
  try {
    const lyrics = await getLyrics(song, { signal: controller.signal });
    if (controller.signal.aborted || state.session.reader !== reader) return;
    reader.lyrics = lyrics; reader.source = detectLanguage(lyrics); reader.status = 'ready';
    await saveSession();
    await cacheFavorite(reader);
    render();
  } catch (error) {
    if (error.name === 'AbortError' || controller.signal.aborted) return;
    reader.status = 'error'; reader.error = error.code;
    scheduleSave(); render();
  }
}

function renderReader() {
  const reader = state.session.reader;
  if (!reader) { state.session.view = 'search'; return renderSearch(); }
  const song = reader.song;
  const heading = el('div', { className: 'reader-heading' }, el('p', { className: 'eyebrow' }, text('lyricsLabel')),
    el('h1', { id: 'song-title' }, song.title), el('p', { className: 'reader-artist' }, song.artist));
  if (reader.status === 'ready' && reader.lyrics) {
    heading.append(el('p', { className: 'reader-source', id: 'lyrics-source' }, text('lyricSource'), ' ',
      externalLink('lyrics.ovh', 'https://lyrics.ovh/', 'source-link')));
  }
  const view = el('section', { className: 'view reader' },
    button(text('back'), () => navigate(reader.from || 'search'), { name: 'back', className: 'back-button', id: 'reader-back' }),
    heading);
  view.append(el('div', { className: 'reader-actions' },
    button(isFavorite(song) ? text('removeFavorite') : text('addFavorite'), () => changeFavorite(song, reader, !isFavorite(song)), { name: 'star', className: `icon-button favorite-button ${isFavorite(song) ? 'active' : ''}`, pressed: isFavorite(song), id: 'favorite-toggle' }),
    button(text(reader.translationVisible ? 'hideTranslation' : 'showTranslation'), toggleTranslation, { name: 'translate', className: `button ${reader.translationVisible ? 'active' : ''}`, pressed: reader.translationVisible, disabled: !reader.lyrics, id: 'translation-toggle' }),
    button(text(youtubeVideoUrl(song.videoUrl) ? 'youtubeOpen' : 'youtubeSearch'), async () => {
      await saveSession(); await browser.tabs.create({ url: youtubeDestination(song) });
    }, { name: 'youtube', className: 'button youtube-button', id: 'youtube-button' })));
  if (reader.status === 'loading') { view.append(loading(text('fetchingLyrics'), true)); return view; }
  if (reader.status === 'error') {
    view.append(empty(text(reader.error === 'notFound' ? 'noLyrics' : 'lyricsError'), text(reader.error === 'notFound' ? 'noLyricsText' : reader.error === 'timeout' ? 'timeout' : 'unavailable'), 'alert',
      button(text('retry'), () => openSong(song, reader.from, { refresh: true }), { name: 'refresh', id: 'retry-lyrics' })));
    return view;
  }
  if (reader.translationVisible) view.append(translationPanel(reader));
  const lines = lyricLines(reader.lyrics);
  const translated = reader.translationVisible ? reader.translations[`${reader.source}|${reader.target}`]?.lines : null;
  view.append(el('div', { className: 'lyrics', id: 'lyrics', 'aria-label': text('lyricsLabel') }, lines.map((line, index) =>
    el('div', { className: `lyric-line ${line.trim() ? '' : 'blank'}`, 'data-line-index': index },
      line.trim() && el('p', { className: 'original', lang: reader.source || undefined }, line),
      translated?.[index] && el('p', { className: 'translation', lang: reader.target }, translated[index])))));
  if (reader.cached) view.append(el('footer', { className: 'source' }, text('offlineFavorite')));
  return view;
}

function languageSelect(id, value, options, onChange, placeholder) {
  const select = el('select', { id, onChange });
  if (placeholder) select.append(el('option', { value: '' }, text('chooseLanguage')));
  options.forEach(code => select.append(el('option', { value: code }, languageName(code, state.preferences.locale))));
  select.value = value;
  return select;
}

function translationPanel(reader) {
  const panel = el('div', { className: 'translation-panel' });
  const source = languageSelect('source-language', reader.source, translationLanguages, event => {
    translationController?.abort(); reader.source = event.target.value; scheduleSave(); render(); startTranslation();
  }, !reader.source);
  const target = languageSelect('target-language', reader.target, ['pt', 'en'], async event => {
    translationController?.abort(); reader.target = event.target.value;
    try { state.preferences = await rpc('PREFERENCES', { value: { translationTarget: reader.target } }); }
    catch { toast('storageError'); }
    scheduleSave(); render(); startTranslation();
  });
  panel.append(el('div', { className: 'language-pair' }, el('label', { className: 'field', for: 'source-language' }, text('translateFrom'), source), icon('arrow'),
    el('label', { className: 'field', for: 'target-language' }, text('translateTo'), target)),
  el('p', { className: 'translation-caption' }, externalLink(text('automaticTranslation'), 'https://mymemory.translated.net/', '')),
  el('div', { id: 'translation-status', className: 'translation-status', role: 'status' }));
  const status = panel.querySelector('#translation-status');
  renderTranslationStatus(status, reader);
  return panel;
}

function renderTranslationStatus(container, reader) {
  const current = reader.translations[`${reader.source}|${reader.target}`];
  container.replaceChildren();
  if (!reader.source) container.append(text('unknownLanguage'));
  else if (reader.source === reader.target) container.append(text('sameLanguage'));
  else if (reader.translating) {
    const total = lyricLines(reader.lyrics).filter(line => line.trim()).length;
    const done = current?.lines.filter(Boolean).length || 0;
    container.append(text('translating', { done, total }));
  } else if (current && !current.complete) {
    container.append(el('p', {}, text(current.error === 'quota' ? 'translationQuota' : 'translationPartial')),
      button(text('retry'), startTranslation, { name: 'refresh', id: 'retry-translation' }));
  }
}

function toggleTranslation() {
  const reader = state.session.reader;
  reader.translationVisible = !reader.translationVisible;
  if (!reader.translationVisible) { translationController?.abort(); reader.translating = false; }
  scheduleSave(); render();
  if (reader.translationVisible) startTranslation();
}

async function startTranslation() {
  const reader = state.session.reader;
  if (!reader?.translationVisible || !reader.source || reader.source === reader.target) return;
  translationController?.abort();
  const controller = new AbortController(); translationController = controller;
  const key = `${reader.source}|${reader.target}`;
  if (reader.translations[key]?.complete) { reader.translating = false; render(); return; }
  reader.translating = true;
  reader.translations[key] ||= { lines: [], complete: false };
  render();
  try {
    const result = await translateLines(lyricLines(reader.lyrics), reader.source, reader.target, {
      signal: controller.signal, cached: reader.translations[key].lines,
      onProgress: lines => {
        if (controller.signal.aborted || state.session.reader !== reader) return;
        reader.translations[key].lines = lines;
        scheduleSave();
        if (reader.translationVisible && `${reader.source}|${reader.target}` === key) updateTranslationLines(reader, lines);
      },
    });
    if (controller.signal.aborted || state.session.reader !== reader) return;
    reader.translations[key] = result; reader.translating = false;
    await saveSession(); await cacheFavorite(reader);
    render();
  } catch (error) {
    if (error.name === 'AbortError') return;
    reader.translating = false;
    reader.translations[key].error = error.code || 'translationPartial';
    scheduleSave(); render();
  }
}

function updateTranslationLines(reader, lines) {
  const anchor = readingAnchor();
  lines.forEach((line, index) => {
    if (!line) return;
    const wrapper = document.querySelector(`[data-line-index="${index}"]`);
    if (wrapper && !wrapper.querySelector('.translation')) wrapper.append(el('p', { className: 'translation', lang: reader.target }, line));
  });
  const status = document.getElementById('translation-status');
  if (status) renderTranslationStatus(status, reader);
  restoreAnchor(anchor);
}

async function changeFavorite(song, reader, enabled) {
  try {
    const result = await rpc('FAVORITE', { song, reader, enabled });
    state.favorites = result.favorites;
    render();
    toast(enabled ? 'saved' : 'removed', enabled ? null : async () => {
      const restored = await rpc('FAVORITE', { song: result.favorite.song, reader: result.favorite.reader, savedAt: result.favorite.savedAt, enabled: true });
      state.favorites = restored.favorites; render();
    });
  } catch { toast('storageError'); }
}

async function cacheFavorite(reader) {
  await rpc('CACHE_FAVORITE', { reader });
  state.favorites = state.favorites.map(item => item.song.key === reader.song.key ? { ...item, reader: structuredClone(reader) } : item);
}

function renderSettings() {
  const localeSelect = el('select', { id: 'interface-language', onChange: async event => {
    try { state.preferences = await rpc('PREFERENCES', { value: { locale: event.target.value } }); await saveSession(); render(); }
    catch { toast('storageError'); }
  } }, el('option', { value: 'pt-BR' }, 'Português (Brasil)'), el('option', { value: 'en' }, 'English'));
  localeSelect.value = state.preferences.locale;
  const target = languageSelect('preferred-translation', state.preferences.translationTarget, ['pt', 'en'], async event => {
    try { state.preferences = await rpc('PREFERENCES', { value: { translationTarget: event.target.value } }); render(); }
    catch { toast('storageError'); }
  });
  return el('section', { className: 'view' },
    button(text('back'), () => navigate(settingsFrom), { name: 'back', className: 'back-button' }), intro(text('settings'), text('preferenceIntro')),
    el('div', { className: 'settings-fields' }, el('label', { className: 'field', for: 'interface-language' }, text('language'), localeSelect),
      el('label', { className: 'field', for: 'preferred-translation' }, text('translationPreference'), target)),
    el('section', { className: 'settings-section' }, el('h2', {}, text('about')), el('p', {}, text('aboutText')),
      externalLink(text('repository'), 'https://github.com/leobrqz/LyricsExtension'), el('span', { className: 'version' }, `v${browser.runtime.getManifest().version}`)),
    el('section', { className: 'settings-section' }, el('h2', {}, text('privacy')), el('p', {}, text('privacyText')), el('p', { className: 'small' }, text('storedData'))),
    el('section', { className: 'settings-section' }, el('h2', {}, text('services')), externalLink('lyrics.ovh', 'https://github.com/NTag/lyrics.ovh'),
      externalLink('MyMemory', 'https://mymemory.translated.net/'), el('p', { className: 'small' }, text('translationLimits'))));
}

async function boot() {
  const generation = ++bootGeneration;
  abortRequests(); clearTimeout(saveTimer);
  try {
    const snapshot = await rpc('BOOT');
    if (generation !== bootGeneration) return;
    state = snapshot;
    searchStatus = state.session.results.length ? 'ready' : 'idle';
    if (state.session.reader) state.session.reader.translating = false;
    lastView = undefined;
    render({ focus: state.session.view === 'search' });
    if (state.session.view === 'search' && state.session.query.trim() && (!state.session.results.length || state.session.autoOpen)) runSearch();
    if (state.session.view === 'reader' && state.session.reader?.status === 'loading') {
      const reader = state.session.reader;
      openSong(reader.song, reader.from);
    }
  } catch {
    root.setAttribute('aria-busy', 'false');
    root.replaceChildren(empty('Lyrics Extension', t(initialPreferences(navigator.language).locale, 'storageError'), 'alert', button(t(initialPreferences(navigator.language).locale, 'retry'), boot)));
  }
}

browser.runtime.onMessage.addListener(message => { if (message.type === 'CONTEXT_CHANGED') boot(); });
window.addEventListener('pagehide', () => { captureScroll(); clearTimeout(saveTimer); saveSession().catch(() => {}); abortRequests(); });
boot();
