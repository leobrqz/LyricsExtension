import { el, icon } from './dom.js';
import { t, initialPreferences } from './i18n.js';
import { searchSongs } from './api.js';
import { getSongLyrics, getPublishedTranslation, letrasTitleMatches } from './letras.js';
import { filterFavorites, lyricLines, confidentMatch, matchedVideo, youtubeDestination, youtubeVideoUrl } from './model.js';

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
const differentLetrasVersion = (reader, song = reader?.song) => reader?.provider?.name === 'letras'
  && reader.provider.title && song?.title && !letrasTitleMatches(song.title, reader.provider.title);

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
    el('button', { className: 'brand', type: 'button', 'aria-label': `Lyrics · ${text('search')}`, onClick: () => navigate('search') }, 'lyrics'),
    button(text('settings'), () => navigate('settings'), { name: 'settings', className: `icon-button ${state.session.view === 'settings' ? 'active' : ''}`, id: 'settings-button' }));
  const content = el('main', { id: 'content', tabindex: '-1', 'aria-label': text(state.session.view === 'reader' ? 'lyricsLabel' : state.session.view), onScroll: () => { captureScroll(); scheduleSave(); } });
  content.append(state.session.view === 'reader' ? renderReader() : state.session.view === 'favorites' ? renderFavorites() : state.session.view === 'recents' ? renderRecents() : state.session.view === 'settings' ? renderSettings() : renderSearch());
  if (lastView === state.session.view) content.firstElementChild.style.animation = 'none';
  const libraryView = state.session.view === 'settings' ? settingsFrom : state.session.view;
  const activeNav = libraryView === 'reader' ? state.session.reader?.from || 'search' : libraryView;
  const nav = el('nav', { className: 'top-nav', 'aria-label': 'Lyrics' },
    navButton('search', activeNav), navButton('favorites', activeNav), navButton('recents', activeNav));
  root.replaceChildren(header, nav, content, toastElement);
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

function navButton(view, active) {
  const node = button(text(view), () => navigate(view), { className: `nav-button ${active === view ? 'selected' : ''}`, id: `nav-${view}` });
  if (active === view) node.setAttribute('aria-current', 'page');
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

function searchField(value, label, placeholder, handler, { showIcon = true } = {}) {
  let composing = false;
  const input = el('input', { id: 'search-input', type: 'text', value, placeholder, 'aria-label': label,
    autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false',
    onCompositionStart: () => { composing = true; clearTimeout(searchTimer); searchController?.abort(); },
    onCompositionEnd: event => { composing = false; handler(event.target.value); },
    onInput: event => { if (!composing && !event.isComposing) handler(event.target.value); } });
  const clear = value ? button(text('clear'), () => { handler(''); document.getElementById('search-input')?.focus(); }, { name: 'close', className: 'icon-button', id: 'clear-search' }) : el('span', { className: 'clear-placeholder' });
  return el('div', { className: 'search-box' }, showIcon && icon('search'), input, clear);
}

function collectionHeading(title, count) {
  return el('div', { className: 'collection-heading' }, el('h1', {}, title),
    count !== undefined && el('span', { className: 'count' }, text(count === 1 ? 'songCountOne' : 'songCount', { count })));
}

function empty(title, description, action) {
  return el('section', { className: 'empty', role: 'status' },
    el('h2', {}, title), el('p', {}, description), action);
}

function loading(label, skeleton = false) {
  return el('div', {}, el('div', { className: 'loading', role: 'status' }, el('span', { className: 'spinner', 'aria-hidden': 'true' }), label),
    skeleton && el('div', { className: 'skeleton', 'aria-hidden': 'true' }, Array.from({ length: 6 }, () => el('span'))));
}

function renderSearch() {
  const query = state.session.query;
  const view = el('section', { className: `view search-view ${!query.trim() ? 'search-idle' : ''}` },
    searchField(query, text('searchLabel'), text('searchPlaceholder'), onSearchInput));
  if (!query.trim()) {
    if (state.recents.length) view.append(listHeading(text('recents'), state.recents.length), songList(state.recents.map(item => item.song)));
  } else if (searchStatus === 'loading') {
    view.append(loading(text(slowSearch ? 'slow' : 'searching'), true));
  } else if (searchStatus === 'error') {
    view.append(empty(text('searchError'), text(searchError === 'timeout' ? 'timeout' : 'unavailable'), button(text('retry'), runSearch, { name: 'refresh' })));
  } else if (state.session.results.length) {
    view.append(listHeading(text('results'), state.session.results.length), songList(state.session.results));
  } else if (searchStatus === 'ready') {
    view.append(empty(text('noResults'), text('noResultsText')));
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
  return el('div', { className: 'list-heading', role: 'status' }, el('h2', { className: 'list-label' }, label), el('span', { className: 'count' }, count));
}

function songList(songs, from = 'search') {
  const favorites = from === 'favorites';
  return el('div', { className: 'song-list' }, songs.map(song => {
    const row = el('article', { className: 'song-row' }, el('button', { type: 'button', className: 'song-open', 'data-song-key': song.key, onClick: () => openSong(song, from) },
      el('span', { className: 'song-info' }, el('span', { className: 'song-title' }, song.title), el('span', { className: 'song-artist' }, song.artist)),
      icon('chevron')));
    if (favorites) row.append(button(`${text('removeFavorite')} · ${song.title}`, () => changeFavorite(song, null, false), { name: 'close', className: 'icon-button remove-favorite' }));
    return row;
  }));
}

function renderFavorites() {
  const filtered = filterFavorites(state.favorites, state.session.favoritesQuery);
  const view = el('section', { className: 'view favorites-view' }, collectionHeading(text('favorites'), state.favorites.length),
    searchField(state.session.favoritesQuery, text('favoritesPlaceholder'), text('favoritesPlaceholder'), value => {
      state.session.favoritesQuery = value; state.session.favoritesScroll = 0; scheduleSave(); render({ scroll: 0 });
    }, { showIcon: false }));
  if (!state.favorites.length) view.append(empty(text('emptyFavorites'), text('emptyFavoritesText')));
  else if (!filtered.length) view.append(empty(text('emptyFilter'), text('emptyFilterText'), button(text('searchAll'), () => {
    const query = state.session.favoritesQuery;
    navigate('search'); onSearchInput(query);
  }, { name: 'search' })));
  else view.append(songList(filtered.map(item => item.song), 'favorites'));
  return view;
}

function renderRecents() {
  const view = el('section', { className: 'view recents-view' }, collectionHeading(text('recents'), state.recents.length));
  if (!state.recents.length) view.append(empty(text('emptyRecents'), text('emptyRecentsText')));
  else {
    view.append(el('div', { className: 'collection-actions' }, button(text('clearRecents'), async () => {
      try {
        state.recents = await rpc('CLEAR_RECENTS');
        state.session.recentsScroll = 0;
        scheduleSave(); render({ scroll: 0 });
      } catch { toast('storageError'); }
    }, { className: 'text-button', id: 'clear-recents' })),
    songList(state.recents.map(item => item.song), 'recents'));
  }
  return view;
}

async function rememberSong(song) {
  try { state.recents = await rpc('RECENT', { song }); }
  catch { toast('storageError'); }
}

async function openSong(song, from, { refresh = false } = {}) {
  captureScroll(); abortRequests();
  let cached = refresh ? null : state.favorites.find(item => item.song.key === song.key)?.reader;
  if (differentLetrasVersion(cached, song)) cached = null;
  const videoUrl = (from === 'search' && matchedVideo(song, state.session.origin)) || song.videoUrl || cached?.song?.videoUrl;
  const reader = cached?.lyrics ? { ...structuredClone(cached), from, song: { ...song, videoUrl }, translationVisible: false, cached: true }
    : { song: { ...song, videoUrl }, from, lyrics: '', provider: null, translationVisible: false, translation: null, status: 'loading', cached: false };
  state.session.reader = reader;
  state.session.view = 'reader'; state.session.readerScroll = 0;
  render({ scroll: 0 });
  scheduleSave();
  if (reader.lyrics) { reader.status = 'ready'; await rememberSong(reader.song); render(); return; }
  const controller = new AbortController(); lyricsController = controller;
  try {
    const result = await getSongLyrics(song, { signal: controller.signal });
    if (controller.signal.aborted || state.session.reader !== reader) return;
    reader.lyrics = result.lyrics; reader.provider = result.provider; reader.status = 'ready';
    await saveSession();
    await cacheFavorite(reader);
    if (controller.signal.aborted || state.session.reader !== reader) return;
    await rememberSong(reader.song);
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
  const metadata = el('div', { className: 'reader-meta' }, el('p', { className: 'reader-artist' }, song.artist));
  const heading = el('div', { className: 'reader-heading' }, el('h1', { id: 'song-title' }, song.title), metadata);
  if (reader.status === 'ready' && reader.lyrics) {
    const fromLetras = reader.provider?.name === 'letras';
    const source = el('div', { className: `reader-source ${fromLetras ? '' : 'api-source'}`, id: 'lyrics-source', 'aria-label': text(fromLetras ? 'lyricSource' : 'lyricVia') },
      !fromLetras && `${text('lyricVia')} `,
      externalLink(fromLetras ? 'Letras.mus.br' : 'lyrics.ovh', reader.provider?.url || 'https://lyrics.ovh/', 'source-link'));
    if (!fromLetras) source.append(el('span', { className: 'source-detail' }, text('sourceUnknown')),
      button(text('tryLetras'), () => openSong(song, reader.from, { refresh: true }), { name: 'refresh', className: 'source-retry', id: 'source-retry' }));
    metadata.append(source);
  }
  const saved = isFavorite(song);
  const favoriteLabel = text(saved ? 'removeFavorite' : 'addFavorite');
  const youtubeLabel = text(youtubeVideoUrl(song.videoUrl) ? 'youtubeOpen' : 'youtubeSearch');
  const actions = el('div', { className: 'reader-actions' },
    el('button', { type: 'button', className: 'action-button', id: 'favorite-toggle', title: favoriteLabel, 'aria-label': favoriteLabel,
      'aria-pressed': String(saved), onClick: () => changeFavorite(song, reader, !isFavorite(song)) }, icon('heart', saved), text(saved ? 'favoriteSaved' : 'saveFavorite')),
    el('span', { className: 'action-divider', 'aria-hidden': 'true' }),
    el('button', { type: 'button', className: 'action-button youtube-button', id: 'youtube-button', title: youtubeLabel, 'aria-label': youtubeLabel, onClick: async () => {
      await saveSession(); await browser.tabs.create({ url: youtubeDestination(song) });
    } }, icon('external'), 'YouTube'),
    el('button', { type: 'button', className: 'translation-toggle', id: 'translation-toggle', role: 'switch', 'aria-checked': String(reader.translationVisible),
      'aria-label': text(reader.translationVisible ? 'hideTranslation' : 'showTranslation'), disabled: !reader.lyrics, onClick: toggleTranslation },
    el('span', { className: 'switch', 'aria-hidden': 'true' }), text('translation')));
  const header = el('header', { className: 'reader-head' },
    button(text('back'), () => navigate(reader.from || 'search'), { name: 'back', className: 'back-button', id: 'reader-back' }),
    heading, actions);
  const body = el('div', { className: 'reader-body' });
  const view = el('section', { className: 'view reader' }, header, body);
  if (reader.status === 'loading') { body.append(loading(text('fetchingLyrics'), true)); return view; }
  if (reader.status === 'error') {
    body.append(empty(text(reader.error === 'notFound' ? 'noLyrics' : 'lyricsError'), text(reader.error === 'notFound' ? 'noLyricsText' : reader.error === 'timeout' ? 'timeout' : 'unavailable'),
      button(text('retry'), () => openSong(song, reader.from, { refresh: true }), { name: 'refresh', id: 'retry-lyrics' })));
    return view;
  }
  if (reader.translationVisible && (reader.translating || reader.translationError)) body.append(translationPanel(reader));
  const lines = lyricLines(reader.lyrics);
  const translated = reader.translationVisible ? reader.translation?.lines : null;
  body.append(el('div', { className: 'lyrics', id: 'lyrics', 'aria-label': text('lyricsLabel') }, lines.map((line, index) =>
    el('div', { className: `lyric-line ${line.trim() ? '' : 'blank'}`, 'data-line-index': index },
      line.trim() && el('p', { className: 'original' }, line),
      translated?.[index] && el('p', { className: 'translation', lang: 'pt' }, translated[index])))));
  const notes = el('footer', { className: 'reader-notes' });
  if (translated && reader.translation.url) notes.append(externalLink(text('publishedTranslation'), reader.translation.url, 'source-link'));
  if (reader.cached) notes.append(el('p', {}, text('offlineFavorite')));
  if (notes.childElementCount) body.append(notes);
  return view;
}

function translationPanel(reader) {
  const panel = el('div', { className: 'translation-panel' });
  panel.append(el('div', { id: 'translation-status', className: 'translation-status', role: 'status' }));
  const status = panel.querySelector('#translation-status');
  renderTranslationStatus(status, reader);
  return panel;
}

function renderTranslationStatus(container, reader) {
  container.replaceChildren();
  if (reader.translating) container.append(text('loadingTranslation'));
  else if (reader.translationError) {
    const key = ['translationNotFound', 'translationMismatch'].includes(reader.translationError) ? reader.translationError : 'translationUnavailable';
    container.append(el('p', {}, text(key)),
      button(text('retry'), startTranslation, { name: 'refresh', id: 'retry-translation' }));
    if (reader.provider?.name !== 'letras') container.append(' ',
      button(text('reloadLyrics'), () => openSong(reader.song, reader.from, { refresh: true }), { name: 'refresh', id: 'reload-lyrics' }));
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
  if (!reader?.translationVisible) return;
  translationController?.abort();
  const controller = new AbortController(); translationController = controller;
  if (reader.translation?.provider === 'letras') { reader.translating = false; render(); return; }
  reader.translating = true; reader.translationError = null;
  render();
  try {
    const result = await getPublishedTranslation(reader, { signal: controller.signal });
    if (controller.signal.aborted || state.session.reader !== reader) return;
    reader.translation = result; reader.translating = false;
    reader.translationError = result ? null : 'translationNotFound';
    await saveSession(); await cacheFavorite(reader);
    render();
  } catch (error) {
    if (error.name === 'AbortError' || controller.signal.aborted || state.session.reader !== reader) return;
    reader.translating = false;
    reader.translationError = error.code || 'translationUnavailable';
    scheduleSave(); render();
  }
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
  return el('section', { className: 'view settings-view' },
    button(text('back'), () => navigate(settingsFrom), { name: 'back', className: 'back-button' }), collectionHeading(text('settings')),
    el('div', { className: 'settings-fields' }, el('label', { className: 'field', for: 'interface-language' }, text('language'), localeSelect)),
    el('section', { className: 'settings-section' }, el('h2', {}, text('about')), el('p', {}, text('aboutText')),
      externalLink(text('repository'), 'https://github.com/leobrqz/LyricsExtension'), el('span', { className: 'version' }, `v${browser.runtime.getManifest().version}`)),
    el('section', { className: 'settings-section' }, el('h2', {}, text('privacy')), el('p', {}, text('privacyText')), el('p', { className: 'small' }, text('storedData'))),
    el('section', { className: 'settings-section' }, el('h2', {}, text('services')), externalLink('lyrics.ovh', 'https://github.com/NTag/lyrics.ovh'),
      externalLink('Letras.mus.br', 'https://www.letras.mus.br/'), el('p', { className: 'small' }, text('contentSources'))));
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
    if (state.session.view === 'reader' && (state.session.reader?.status === 'loading' || differentLetrasVersion(state.session.reader))) {
      const reader = state.session.reader;
      openSong(reader.song, reader.from, { refresh: true });
    }
  } catch {
    root.setAttribute('aria-busy', 'false');
    root.replaceChildren(empty('Lyrics Extension', t(initialPreferences(navigator.language).locale, 'storageError'), button(t(initialPreferences(navigator.language).locale, 'retry'), boot)));
  }
}

browser.runtime.onMessage.addListener(message => { if (message.type === 'CONTEXT_CHANGED') boot(); });
window.addEventListener('pagehide', () => { captureScroll(); clearTimeout(saveTimer); saveSession().catch(() => {}); abortRequests(); });
boot();
