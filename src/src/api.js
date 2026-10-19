import { cleanQuery, uniqueSongs, normalizeLyrics } from './model.js';

// Replaced at build time; all production traffic goes to the approved public services.
export const LYRICS_API = typeof __LYRICS_API__ === 'undefined' ? 'https://api.lyrics.ovh' : __LYRICS_API__;
export const TRANSLATION_API = typeof __TRANSLATION_API__ === 'undefined' ? 'https://api.mymemory.translated.net' : __TRANSLATION_API__;

export class ServiceError extends Error {
  constructor(code, cause) { super(code, { cause }); this.name = 'ServiceError'; this.code = code; }
}

export async function requestJson(url, { signal, timeout = 16000, fetcher = fetch } = {}) {
  const timeoutSignal = AbortSignal.timeout(timeout);
  const combined = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  try {
    const response = await fetcher(url, { signal: combined, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new ServiceError(response.status === 404 ? 'notFound' : response.status === 429 ? 'quota' : 'unavailable');
    return await response.json();
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (timeoutSignal.aborted) throw new ServiceError('timeout', error);
    if (error instanceof ServiceError) throw error;
    throw new ServiceError('unavailable', error);
  }
}

export async function searchSongs(query, options = {}) {
  const text = cleanQuery(query);
  if (!text) return [];
  const data = await requestJson(`${LYRICS_API}/suggest/${encodeURIComponent(text)}`, options);
  if (data.error || !Array.isArray(data.data)) throw new ServiceError('unavailable');
  return uniqueSongs(data.data);
}

export async function getLyrics(song, options = {}) {
  const data = await requestJson(`${LYRICS_API}/v1/${encodeURIComponent(song.artist)}/${encodeURIComponent(song.title)}`, options);
  const text = normalizeLyrics(data.lyrics);
  if (!text || data.error) throw new ServiceError('notFound');
  return text;
}
