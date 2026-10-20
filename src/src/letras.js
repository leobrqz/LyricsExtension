// Adapted from NTag/lyrics.ovh (MIT). Copyright (c) Basile Bruneau.
import { getLyrics, ServiceError } from './api.js';
import { normalizeLyrics, lyricLines } from './model.js';

const ORIGIN = 'https://www.letras.mus.br';
const FETCH_ORIGIN = typeof __LETRAS_BASE__ === 'undefined' ? ORIGIN : __LETRAS_BASE__;
const deburr = value => value.normalize('NFD').replace(/\p{M}/gu, '');
const slug = value => deburr(value).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
const titleKey = value => deburr(value).toLowerCase().replace(/[^a-z0-9]/g, '');

export function letrasTitleMatches(requested, found) {
  return Boolean(titleKey(requested) && titleKey(requested) === titleKey(found));
}

export function letrasSongUrl(value, artist, translated = false) {
  const url = new URL(value, ORIGIN);
  const parts = url.pathname.split('/');
  if (url.protocol !== 'https:' || !['www.letras.mus.br', 'letras.mus.br'].includes(url.hostname)
    || url.port || url.username || url.password || url.search || url.hash || parts.length !== 4
    || !parts[1] || !parts[2] || (artist && parts[1] !== artist)
    || parts[3] !== (translated ? 'traducao.html' : '')) throw new ServiceError('notFound');
  url.hostname = 'www.letras.mus.br';
  return url;
}

async function fetchPage(url, { signal, fetcher = fetch, timeout = 8000 } = {}) {
  const timed = AbortSignal.timeout(timeout);
  try {
    const response = await fetcher(FETCH_ORIGIN + url.pathname, {
      signal: signal ? AbortSignal.any([signal, timed]) : timed,
      credentials: 'omit', referrerPolicy: 'no-referrer',
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ServiceError(response.status === 404 ? 'notFound' : 'unavailable');
    }
    const final = new URL(response.url);
    if (![new URL(FETCH_ORIGIN).origin, ORIGIN, 'https://letras.mus.br'].includes(final.origin)
      || final.search || final.hash) throw new ServiceError('unavailable');
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    return { doc, url: new URL(final.pathname, ORIGIN) };
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (timed.aborted) throw new ServiceError('timeout', error);
    if (error instanceof ServiceError) throw error;
    throw new ServiceError('unavailable', error);
  }
}

function matchingTitle(doc, title) {
  const found = doc.querySelector('h1')?.textContent.trim() || '';
  if (!letrasTitleMatches(title, found)) throw new ServiceError('notFound');
  return found;
}

async function letrasLyrics(song, options) {
  const artist = slug(song.artist);
  if (!artist || !slug(song.title)) throw new ServiceError('notFound');
  const readSong = async url => {
    const page = await fetchPage(url, options);
    letrasSongUrl(page.url.href, artist);
    const foundTitle = matchingTitle(page.doc, song.title);
    const canonical = letrasSongUrl(page.doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || page.url.href, artist);
    const paragraphs = [...page.doc.querySelectorAll('.lyric-original p, .lyric-tra p')];
    const lyrics = normalizeLyrics(paragraphs.map(p => {
      p.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
      return p.textContent.trim();
    }).join('\n\n'));
    if (!lyrics) throw new ServiceError('notFound');
    return { lyrics, provider: { name: 'letras', url: canonical.href, title: foundTitle } };
  };
  const direct = letrasSongUrl(`/${artist}/${slug(song.title)}/`, artist);
  try { return await readSong(direct); }
  catch (error) { if (error.code !== 'notFound') throw error; }

  // Title aliases can point to another version; the artist catalog links the exact song.
  const catalog = await fetchPage(new URL(`/${artist}/`, ORIGIN), options);
  if (catalog.url.pathname !== `/${artist}/`) throw new ServiceError('notFound');
  const seen = new Set([direct.href]);
  for (const link of catalog.doc.querySelectorAll('a[href]')) {
    if (titleKey(link.getAttribute('title') || link.textContent.trim()) !== titleKey(song.title)) continue;
    let url;
    try { url = letrasSongUrl(link.getAttribute('href'), artist); }
    catch { continue; }
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    try {
      return await readSong(url);
    } catch (error) {
      if (error.code !== 'notFound') throw error;
    }
  }
  throw new ServiceError('notFound');
}

export async function getSongLyrics(song, options = {}) {
  let letrasError;
  try { return await letrasLyrics(song, options); }
  catch (error) {
    if (error.name === 'AbortError') throw error;
    letrasError = error;
  }
  try { return { lyrics: await getLyrics(song, options), provider: { name: 'lyrics.ovh', url: 'https://lyrics.ovh/' } }; }
  catch (error) {
    if (error.code === 'notFound' && letrasError.code !== 'notFound') throw letrasError;
    throw error;
  }
}

export function alignPublishedTranslation(lyrics, originals, translations) {
  const key = value => value.normalize('NFC').replace(/\s+/g, ' ').trim();
  const lines = lyricLines(lyrics);
  const nonempty = lines.filter(line => line.trim());
  if (nonempty.length !== originals.length || originals.length !== translations.length
    || nonempty.some((line, index) => key(line) !== key(originals[index]) || !translations[index]?.trim())) {
    throw new ServiceError('translationMismatch');
  }
  let index = 0;
  return lines.map(line => line.trim() ? translations[index++] : '');
}

export async function getPublishedTranslation(reader, options = {}) {
  if (reader.provider?.name !== 'letras') return null;
  const source = letrasSongUrl(reader.provider.url);
  const artist = source.pathname.split('/')[1];
  const url = letrasSongUrl(source.href + 'traducao.html', artist, true);
  let page;
  try { page = await fetchPage(url, options); }
  catch (error) { if (error.code === 'notFound') return null; throw error; }
  if (page.url.href === source.href) return null;
  if (page.url.href !== url.href) throw new ServiceError('translationUnavailable');
  matchingTitle(page.doc, reader.provider.title || reader.song.title);
  const canonical = letrasSongUrl(page.doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || page.url.href, artist, true);
  if (canonical.href !== url.href) throw new ServiceError('translationUnavailable');
  const originals = [];
  const translations = [];
  page.doc.querySelectorAll('.lyric-stackedTranslation > p .verse').forEach(verse => {
    // Despite its name, .romanization contains the original published verse.
    originals.push(verse.querySelector(':scope > .romanization')?.textContent.trim() || '');
    translations.push(verse.querySelector(':scope > span:not(.romanization)')?.textContent.trim() || '');
  });
  if (!originals.length) throw new ServiceError('translationUnavailable');
  return { provider: 'letras', language: 'pt', url: canonical.href,
    lines: alignPublishedTranslation(reader.lyrics, originals, translations) };
}
