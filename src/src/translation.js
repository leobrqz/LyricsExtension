import { franc } from 'franc-min';
import { ServiceError, requestJson } from './api.js';
import { lyricLines } from './model.js';
import { translateLocally } from './bergamot.js';

export const TRANSLATION_ENGINES = ['published', 'bergamot', 'mymemory'];
export const SOURCE_LANGUAGES = { en: 'eng', es: 'spa', fr: 'fra', de: 'deu', it: 'ita', pt: 'por', ru: 'rus',
  ja: 'jpn', ko: 'kor', zh: 'cmn', uk: 'ukr', nl: 'nld', pl: 'pol', sv: 'swe', tr: 'tur', ar: 'arb', hi: 'hin', cs: 'ces', bg: 'bul', et: 'est' };
export const MYMEMORY_API = typeof __MYMEMORY_API__ === 'undefined' ? 'https://api.mymemory.translated.net' : __MYMEMORY_API__;

export function declaredTranslationOrigins(origins, manifest) {
  const optional = manifest.optional_host_permissions || [];
  return origins.map(origin => optional.find(pattern => new URL(pattern).origin === new URL(origin).origin) || origin);
}

export function detectSource(lyrics, preference = 'auto') {
  if (preference !== 'auto' && SOURCE_LANGUAGES[preference]) return preference;
  const detected = franc(lyrics, { minLength: 15, only: Object.values(SOURCE_LANGUAGES) });
  const language = Object.keys(SOURCE_LANGUAGES).find(key => SOURCE_LANGUAGES[key] === detected);
  if (!language) throw new ServiceError('translationLanguage');
  return language;
}

export function translationKey(engine, source = 'auto') {
  return engine === 'published' ? 'published' : `${engine}:1:${source}:pt`;
}

export function cachedTranslation(reader, engine, source) {
  return reader.translationCache?.[translationKey(engine, source)]
    || (engine === 'published' && reader.translation?.provider === 'letras' ? reader.translation : null);
}

export function splitUtf8(text, maxBytes = 480) {
  const encoder = new TextEncoder();
  const parts = [];
  let part = '';
  for (const character of text) {
    if (encoder.encode(part + character).length > maxBytes && part) {
      const space = part.lastIndexOf(' ');
      const end = space > part.length / 2 ? space + 1 : part.length;
      parts.push(part.slice(0, end)); part = part.slice(end);
    }
    part += character;
  }
  if (part) parts.push(part);
  return parts;
}

function decodeEntities(value) {
  // API output is always inserted as text. Decode only common entities, never HTML markup.
  return String(value).replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (named[entity]) return named[entity];
    const code = entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  });
}

export async function translateMyMemory(texts, source, { signal, onProgress, fetcher } = {}) {
  if (!fetcher && typeof browser !== 'undefined' && browser.permissions) {
    const origin = `${new URL(MYMEMORY_API).origin}/*`;
    if (!await browser.permissions.contains({ origins: [origin] })) {
      const error = new ServiceError('translationServicePermission');
      error.origins = [origin];
      throw error;
    }
  }
  const output = new Array(texts.length);
  let next = 0;
  let done = 0;
  const run = async () => {
    while (next < texts.length) {
      signal?.throwIfAborted();
      const index = next++;
      const parts = [];
      for (const part of splitUtf8(texts[index])) {
        const query = new URLSearchParams({ q: part, langpair: `${source}|pt-BR`, mt: '1' });
        let data;
        try { data = await requestJson(`${MYMEMORY_API}/get?${query}`, { signal, fetcher }); }
        catch (error) { if (error.code === 'quota') throw new ServiceError('translationQuota'); throw error; }
        if (data.quotaFinished || Number(data.responseStatus) === 429 || /MYMEMORY WARNING|USED ALL AVAILABLE FREE/i.test(data.responseData?.translatedText || '')) throw new ServiceError('translationQuota');
        if (Number(data.responseStatus) !== 200 || typeof data.responseData?.translatedText !== 'string' || !data.responseData.translatedText.trim()) throw new ServiceError('translationUnavailable');
        const translated = decodeEntities(data.responseData.translatedText)
          .replace(/<(bpt|ept|ph|it)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
          .replace(/<\/?(?:bpt|ept|ph|it|x|bx|ex|g|mrk)\b[^>]*>/gi, '').trim();
        if (!translated) throw new ServiceError('translationUnavailable');
        parts.push(translated);
      }
      output[index] = parts.join(' ');
      onProgress?.({ stage: 'translating', done: ++done, total: texts.length });
    }
  };
  // Keep request volume low. The controller owned by the reader cancels both workers.
  const controller = new AbortController();
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  signal = combined;
  try { await Promise.all([run(), run()]); }
  catch (error) { controller.abort(); throw error; }
  return output;
}

export async function translateAutomatic(lyrics, engine, sourcePreference = 'auto', options = {}) {
  if (!['bergamot', 'mymemory'].includes(engine)) throw new ServiceError('translationUnavailable');
  const source = detectSource(lyrics, sourcePreference);
  if (source === 'pt') throw new ServiceError('translationAlreadyPortuguese');
  const lines = lyricLines(lyrics);
  const unique = [...new Set(lines.filter(line => line.trim()))];
  const translated = engine === 'bergamot' ? await translateLocally(unique, source, options) : await translateMyMemory(unique, source, options);
  if (translated.length !== unique.length || translated.some(line => typeof line !== 'string' || !line.trim())) throw new ServiceError('translationUnavailable');
  const lookup = new Map(unique.map((line, index) => [line, translated[index]]));
  return { provider: engine, source, requestedSource: sourcePreference, target: 'pt', lines: lines.map(line => line.trim() ? lookup.get(line) : ''), automatic: true };
}
