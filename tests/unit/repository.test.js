import test from 'node:test';
import assert from 'node:assert/strict';
import { Repository } from '../../src/src/repository.js';

function memoryStorage() {
  const data = { local: {}, session: {} };
  const areas = Object.fromEntries(Object.keys(data).map(area => [area, {
    get: async () => structuredClone(data[area]),
    set: async value => { await new Promise(resolve => setTimeout(resolve, 2)); Object.assign(data[area], structuredClone(value)); },
  }]));
  return { areas, data };
}
const song = { key: 'night letters::window songs', title: 'Window Songs', artist: 'Night Letters' };

test('concurrent saves serialize and cannot lose another favorite', async () => {
  const { areas, data } = memoryStorage();
  const repo = new Repository(areas, 'pt-BR'); await repo.init();
  await Promise.all([repo.setFavorite(song, null, true), repo.setFavorite({ ...song, key: 'ignored', title: 'Other Song' }, null, true)]);
  assert.equal(repo.favorites.length, 2);
  assert.equal(data.local.favorites.length, 2);
  await repo.setFavorite(song, { lyrics: 'original' }, true);
  assert.equal(repo.favorites.length, 2);
});

test('persistent favorites survive a new repository and a fresh browser session', async () => {
  const { areas, data } = memoryStorage();
  const repo = new Repository(areas, 'pt'); await repo.init();
  await repo.setFavorite({ ...song, videoUrl: 'https://www.youtube.com/watch?v=AbCdEfGhI12' }, { lyrics: 'saved copy' }, true);
  data.session = {};
  const reopened = new Repository(areas, 'pt'); await reopened.init();
  assert.equal(reopened.favorites[0].reader.lyrics, 'saved copy');
  assert.equal(reopened.favorites[0].song.videoUrl, 'https://www.youtube.com/watch?v=AbCdEfGhI12');
  assert.equal(reopened.session.query, '');
});

test('late saves from the previous popup cannot overwrite a new context search', async () => {
  const { areas } = memoryStorage(); const repo = new Repository(areas, 'en'); await repo.init();
  const previousId = repo.session.id;
  await repo.startContext('new query', null);
  assert.equal(await repo.patchSession(previousId, { query: 'old query' }), false);
  assert.equal(repo.session.query, 'new query');
});

test('failed storage writes leave saved state intact and do not poison later operations', async () => {
  const { areas } = memoryStorage(); const repo = new Repository(areas, 'en'); await repo.init();
  const originalSet = areas.local.set;
  areas.local.set = async () => { throw new Error('Disk full'); };
  await assert.rejects(repo.setFavorite(song, null, true));
  assert.equal(repo.favorites.length, 0);
  areas.local.set = originalSet;
  await repo.setFavorite(song, null, true);
  assert.equal(repo.favorites.length, 1);
});

test('unsupported preferences cannot create invalid locale or translation settings', async () => {
  const { areas } = memoryStorage(); const repo = new Repository(areas, 'pt-BR'); await repo.init();
  assert.deepEqual(await repo.updatePreferences({ locale: 'invalid', translationTarget: 'javascript:' }), { locale: 'pt-BR' });
});

test('upgrading removes old machine translations while preserving favorite lyrics', async () => {
  const { areas, data } = memoryStorage();
  const reader = { song, lyrics: 'Saved original', translations: { 'en|pt': { lines: ['Automatic text'], complete: true } }, translationVisible: true, source: 'en', target: 'pt' };
  data.local.favorites = [{ song, reader }];
  data.local.preferences = { locale: 'en', translationTarget: 'en' };
  data.session.currentSession = { id: 'previous-session', reader };
  const repo = new Repository(areas, 'pt-BR'); await repo.init();
  assert.equal(repo.favorites[0].reader.lyrics, 'Saved original');
  assert.equal(repo.favorites[0].reader.translation, null);
  assert.equal(repo.favorites[0].reader.translationVisible, false);
  assert.equal(data.local.favorites[0].reader.translations, undefined);
  assert.equal(data.session.currentSession.reader.translations, undefined);
  assert.deepEqual(repo.preferences, { locale: 'en' });
});
