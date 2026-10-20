import { defaultSession, songKey } from './model.js';
import { initialPreferences } from './i18n.js';

function restoreReader(value) {
  if (!value) return null;
  const { translations, source, target, ...reader } = value;
  if (translations !== undefined) {
    reader.translation = null;
    reader.translationVisible = false;
    reader.translationError = null;
  }
  reader.translating = false;
  return reader;
}

export class Repository {
  constructor(storage, language) {
    this.storage = storage;
    this.preferences = initialPreferences(language);
    this.favorites = [];
    this.session = defaultSession();
    this.queue = Promise.resolve();
  }

  async init() {
    const [local, temporary] = await Promise.all([
      this.storage.local.get(['preferences', 'favorites']), this.storage.session.get('currentSession'),
    ]);
    if (local.preferences) this.preferences = this.validPreferences(local.preferences);
    if (Array.isArray(local.favorites)) {
      this.favorites = local.favorites.filter(item => typeof item?.song?.title === 'string' && typeof item?.song?.artist === 'string')
        .map(item => ({ ...item, reader: restoreReader(item.reader) }));
    }
    if (temporary.currentSession?.id) this.session = { ...this.session, ...temporary.currentSession, reader: restoreReader(temporary.currentSession.reader) };
    const migrated = {};
    if (Array.isArray(local.favorites) && local.favorites.some(item => item.reader?.translations !== undefined)) migrated.favorites = this.favorites;
    if (local.preferences?.translationTarget !== undefined) migrated.preferences = this.preferences;
    if (Object.keys(migrated).length) await this.storage.local.set(migrated);
    if (temporary.currentSession?.reader?.translations !== undefined) await this.storage.session.set({ currentSession: this.session });
    return this.snapshot();
  }

  validPreferences(value) {
    return {
      locale: ['en', 'pt-BR'].includes(value.locale) ? value.locale : this.preferences.locale,
    };
  }

  snapshot() { return { preferences: this.preferences, favorites: this.favorites, session: this.session }; }

  write(operation) {
    const next = this.queue.then(operation, operation);
    this.queue = next.catch(() => {});
    return next;
  }

  updatePreferences(value) {
    return this.write(async () => {
      const preferences = this.validPreferences({ ...this.preferences, ...value });
      await this.storage.local.set({ preferences });
      this.preferences = preferences;
      return preferences;
    });
  }

  patchSession(id, patch) {
    return this.write(async () => {
      if (id !== this.session.id) return false;
      const next = { ...this.session, ...patch, id };
      await this.storage.session.set({ currentSession: next });
      this.session = next;
      return true;
    });
  }

  startContext(query, origin) {
    return this.write(async () => {
      const next = { ...defaultSession(), query, origin, autoOpen: true };
      await this.storage.session.set({ currentSession: next });
      this.session = next;
      return next;
    });
  }

  setFavorite(song, reader, enabled, savedAt) {
    return this.write(async () => {
      const key = songKey(song);
      const existing = this.favorites.find(item => item.song.key === key);
      let favorite = existing || { song: { ...song, key }, savedAt: Number.isFinite(savedAt) ? savedAt : Date.now(), reader: null };
      if (enabled) favorite = { ...favorite, song: { ...favorite.song, ...song, key }, reader: reader || favorite.reader };
      const favorites = this.favorites.filter(item => item.song.key !== key);
      if (enabled) favorites.push(favorite);
      favorites.sort((a, b) => b.savedAt - a.savedAt);
      await this.storage.local.set({ favorites });
      this.favorites = favorites;
      return { favorites, favorite: existing || favorite };
    });
  }

  updateFavoriteReader(reader) {
    if (!this.favorites.some(item => item.song.key === reader.song.key)) return Promise.resolve();
    return this.write(async () => {
      const favorites = this.favorites.map(item => item.song.key === reader.song.key ? { ...item, reader } : item);
      await this.storage.local.set({ favorites });
      this.favorites = favorites;
    });
  }
}
