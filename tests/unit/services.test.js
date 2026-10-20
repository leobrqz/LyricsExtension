import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSongs, getLyrics, requestJson } from '../../src/src/api.js';
import { alignPublishedTranslation, letrasSongUrl, getPublishedTranslation, letrasTitleMatches } from '../../src/src/letras.js';

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

test('published translations keep stanza gaps and repeated verses in place', () => {
  assert.deepEqual(alignPublishedTranslation('First\n\nSecond\nFirst', ['First', 'Second', 'First'], ['Primeiro', 'Segundo', 'Primeiro']),
    ['Primeiro', '', 'Segundo', 'Primeiro']);
  assert.throws(() => alignPublishedTranslation('First\nSecond', ['Second', 'First'], ['Segundo', 'Primeiro']), { code: 'translationMismatch' });
});

test('Letras song URLs stay on the expected artist, host, and language', () => {
  assert.equal(letrasSongUrl('/fatboy-slim/194195/', 'fatboy-slim').href, 'https://www.letras.mus.br/fatboy-slim/194195/');
  assert.throws(() => letrasSongUrl('https://example.com/fatboy-slim/194195/'), { code: 'notFound' });
  assert.throws(() => letrasSongUrl('/fatboy-slim/194195/english.html', 'fatboy-slim', true), { code: 'notFound' });
});

test('an API fallback cannot be mixed with a different published translation', async () => {
  assert.equal(await getPublishedTranslation({ provider: { name: 'lyrics.ovh' } }, { fetcher: () => { throw new Error('Unexpected request'); } }), null);
});

test('Letras title matching preserves the distinction between song versions', () => {
  assert.equal(letrasTitleMatches('BILLIE JEAN', 'Billie Jean'), true);
  assert.equal(letrasTitleMatches('Billie Jean', 'Billie Jean (Pepsi Version)'), false);
  assert.equal(letrasTitleMatches('Billie Jean (1981 Home Demo)', 'Billie Jean'), false);
});
