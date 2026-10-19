import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSongs, getLyrics, requestJson } from '../../src/src/api.js';
import { translateLines, detectLanguage } from '../../src/src/translation.js';
import { sampleLyrics } from '../fixtures/server.js';

const response = data => ({ ok: true, json: async () => data });

test('title-only search asks for candidates and uses their canonical artist and title for lyrics', async () => {
  const urls = [];
  const fetcher = async url => { urls.push(url); return response(url.includes('/suggest/')
    ? { data: [{ title: 'Window Songs', artist: { name: 'Night Letters' } }] }
    : { lyrics: 'first line\n\nsecond stanza' }); };
  const songs = await searchSongs('Windw Songs', { fetcher });
  const lyrics = await getLyrics(songs[0], { fetcher });
  assert.match(urls[0], /\/suggest\/Windw%20Songs$/);
  assert.match(urls[1], /\/v1\/Night%20Letters\/Window%20Songs$/);
  assert.equal(lyrics, 'first line\n\nsecond stanza');
});

test('discovery failure cannot be mistaken for an empty catalog result', async () => {
  await assert.rejects(searchSongs('test', { fetcher: async () => response({ error: { message: 'upstream unavailable' } }) }), { code: 'unavailable' });
  assert.deepEqual(await searchSongs('test', { fetcher: async () => response({ data: [] }) }), []);
});

test('missing lyrics and transport failures have different error states', async () => {
  await assert.rejects(getLyrics({ artist: 'X', title: 'Y' }, { fetcher: async () => ({ ok: false, status: 404 }) }), { code: 'notFound' });
  await assert.rejects(requestJson('https://example.test', { fetcher: async () => { throw new TypeError('Offline'); } }), { code: 'unavailable' });
});

test('cancelled requests are distinguished from connection errors', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(requestJson('https://example.test', { signal: controller.signal, fetcher: async () => { throw new Error('aborted'); } }), { name: 'AbortError' });
});

test('language detection is local and can leave uncertain short text for manual choice', () => {
  assert.equal(detectLanguage(sampleLyrics), 'en');
  assert.equal(detectLanguage('Oi'), '');
  assert.equal(detectLanguage('A chuva canta na minha janela e a cidade descansa enquanto espero a manhã. As palavras de uma canção continuam aqui para lembrar os caminhos da nossa vida.'), 'pt');
});

test('translation keeps exact verse positions and reuses repeated lines', async () => {
  const calls = [];
  const lines = ['first', '', 'second', 'first'];
  const result = await translateLines(lines, 'en', 'pt', {
    fetcher: async url => {
      const q = new URL(url).searchParams.get('q'); calls.push(q);
      return response({ responseStatus: 200, responseData: { translatedText: `translated ${q}` } });
    },
  });
  assert.deepEqual(result.lines, ['translated first', '', 'translated second', 'translated first']);
  assert.equal(result.complete, true);
  assert.equal(calls.length, 2);
});

test('partial failure leaves a gap rather than shifting another verse into its place', async () => {
  const result = await translateLines(['one', 'missing', 'three'], 'en', 'pt', {
    fetcher: async url => {
      const q = new URL(url).searchParams.get('q');
      if (q === 'missing') throw new TypeError('source down');
      return response({ responseStatus: 200, responseData: { translatedText: `T:${q}` } });
    },
  });
  assert.deepEqual(result.lines, ['T:one', null, 'T:three']);
  assert.equal(result.error, 'translationPartial');
});

test('translation retry only requests missing verses, and quota errors stop the queue', async () => {
  const calls = [];
  const result = await translateLines(['cached', 'quota', 'other', 'not requested'], 'en', 'pt', {
    cached: ['salvo'], fetcher: async url => { calls.push(new URL(url).searchParams.get('q')); return response({ responseStatus: 429, quotaFinished: true }); },
  });
  assert.equal(result.lines[0], 'salvo');
  assert.equal(result.error, 'quota');
  assert.ok(calls.length <= 2);
  assert.ok(!calls.includes('cached'));
});

test('same-language requests never spend the translation allowance', async () => {
  await assert.rejects(translateLines(['test'], 'pt', 'pt'), { code: 'sameLanguage' });
});
