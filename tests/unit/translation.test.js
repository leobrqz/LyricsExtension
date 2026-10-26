import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedTranslation, declaredTranslationOrigins, detectSource, splitUtf8, translateAutomatic, translateMyMemory, translationKey } from '../../src/src/translation.js';
import { checkModelPermissions } from '../../src/src/bergamot.js';
import manifest from '../../src/manifest.json' with { type: 'json' };

const response = data => ({ ok: true, json: async () => data });

test('permission requests preserve the declared model bucket instead of requesting the entire storage host', () => {
  assert.deepEqual(declaredTranslationOrigins(['https://storage.googleapis.com/*', 'https://api.mymemory.translated.net/*'], manifest), [
    'https://storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data/*',
    'https://api.mymemory.translated.net/*',
  ]);
});

test('new model hosts require permission after an upgrade, while cached models work without host access', async () => {
  const files = [{ name: 'https://models.example/enpt/model.bin' }, { name: 'https://models.example/enpt/vocab.bin' }, { name: 'https://other.example/fren/model.bin' }];
  const requested = [];
  const permissions = { contains: async value => { requested.push(...value.origins); return false; } };
  await assert.rejects(checkModelPermissions(files, { keys: async () => [] }, permissions), error => {
    assert.equal(error.code, 'translationModelPermission');
    assert.deepEqual(error.origins, ['https://models.example/*', 'https://other.example/*']);
    return true;
  });
  assert.equal(requested.length, 2, 'multiple model files from one host need one grant');
  await checkModelPermissions(files, { keys: async () => files.map(file => ({ url: file.name })) }, {
    contains: async () => { throw new Error('Offline cached models must not request host access'); },
  });
});

test('translation preserves repeated lines and stanza gaps without sending duplicate verses', async () => {
  const requests = [];
  const result = await translateAutomatic('The river is wide\n\nThe river is wide\nI cannot cross', 'mymemory', 'en', {
    fetcher: async url => {
      const query = new URL(url).searchParams;
      requests.push(query);
      return response({ responseStatus: 200, responseData: { translatedText: query.get('q') === 'The river is wide' ? 'O rio é largo' : 'Não consigo atravessar' } });
    },
  });
  assert.deepEqual(result.lines, ['O rio é largo', '', 'O rio é largo', 'Não consigo atravessar']);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].get('langpair'), 'en|pt-BR');
  assert.equal(requests[0].get('key'), null);
  assert.equal(result.automatic, true);
});

test('API quota warnings and empty responses are never displayed as song translations', async () => {
  await assert.rejects(translateMyMemory(['Hello'], 'en', { fetcher: async () => ({ ok: false, status: 429 }) }), { code: 'translationQuota' });
  for (const data of [
    { responseStatus: 429 },
    { responseStatus: 200, quotaFinished: true },
    { responseStatus: 200, responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS' } },
  ]) await assert.rejects(translateMyMemory(['Hello'], 'en', { fetcher: async () => response(data) }), { code: 'translationQuota' });
  await assert.rejects(translateMyMemory(['Hello'], 'en', { fetcher: async () => response({ responseStatus: 200, responseData: { translatedText: '' } }) }), { code: 'translationUnavailable' });
});

test('long multibyte input stays within the byte limit and cancellation prevents additional requests', async () => {
  const input = 'Amanhã 🌧️ a música continua pela manhã. '.repeat(45);
  const parts = splitUtf8(input);
  assert.equal(parts.join(''), input);
  assert.ok(parts.length > 1);
  assert.ok(parts.every(part => new TextEncoder().encode(part).length <= 480 && !part.includes('\ufffd')));
  const controller = new AbortController();
  let count = 0;
  await assert.rejects(translateMyMemory(['One', 'Two', 'Three'], 'en', { signal: controller.signal, fetcher: async () => {
    count++; controller.abort(); throw new Error('Cancelled');
  } }), { name: 'AbortError' });
  assert.equal(count, 1);
});

test('translation-memory formatting codes are removed while literal text remains text', async () => {
  assert.deepEqual(await translateMyMemory(['River'], 'en', { fetcher: async () => response({ responseStatus: 200, responseData: { translatedText: 'Rio &amp; sol<ex id="_2"/>. ' } }) }), ['Rio & sol.']);
});

test('cached translations stay separate by engine and source-language override', () => {
  const published = { provider: 'letras', lines: ['Publicada'] };
  const local = { provider: 'bergamot', source: 'en', lines: ['Local'] };
  const reader = { translation: published, translationCache: { [translationKey('bergamot', 'en')]: local } };
  assert.equal(cachedTranslation(reader, 'published', 'auto'), published);
  assert.equal(cachedTranslation(reader, 'bergamot', 'en'), local);
  assert.equal(cachedTranslation(reader, 'bergamot', 'auto'), null);
  assert.equal(cachedTranslation(reader, 'mymemory', 'en'), null);
});

test('language overrides handle short or ambiguous lyrics and Portuguese is not translated into itself', async () => {
  assert.equal(detectSource('Are you going to Scarborough Fair? Parsley, sage, rosemary and thyme.'), 'en');
  assert.equal(detectSource('Amor', 'es'), 'es');
  await assert.rejects(translateAutomatic('Minha terra tem palmeiras onde canta o sabiá', 'mymemory', 'pt'), { code: 'translationAlreadyPortuguese' });
  await assert.rejects(translateAutomatic('こんにちは世界', 'bergamot', 'ja'), { code: 'translationUnsupported' });
});
