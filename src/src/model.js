export function normalize(value = '') {
  return String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function cleanQuery(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
    .replace(/\s*[-–—|]\s*(?:official\s+(?:music\s+)?video|official\s+audio|lyrics?\s+video|video\s+oficial|youtube)\b.*$/i, '')
    .replace(/[\[(](?:official\s+(?:music\s+)?video|official\s+audio|lyrics?\s+video|video\s+oficial|hd|4k)[\])]/gi, '')
    .replace(/\s+[-–—|]\s+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function songKey(song) {
  return `${normalize(song.artist)}::${normalize(song.title)}`;
}

export function toSong(item) {
  if (!item || typeof item.title !== 'string' || typeof item.artist?.name !== 'string') return null;
  const song = {
    title: item.title.trim(), artist: item.artist.name.trim(),
    album: String(item.album?.title || ''), duration: Number(item.duration) || 0,
  };
  return song.title && song.artist ? { ...song, key: songKey(song) } : null;
}

export function uniqueSongs(items) {
  const seen = new Set();
  return items.map(toSong).filter(song => song && !seen.has(song.key) && seen.add(song.key));
}

export function filterFavorites(items, query) {
  const words = normalize(query).split(' ').filter(Boolean);
  return items.filter(item => words.every(word => normalize(`${item.song.title} ${item.song.artist}`).includes(word)));
}

export function normalizeLyrics(text) {
  return String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
    .replace(/[\t ]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function lyricLines(text) {
  return normalizeLyrics(text).split('\n');
}

export function confidentMatch(songs, query) {
  if (!songs.length) return false;
  const text = normalize(cleanQuery(query));
  const first = songs[0];
  const title = normalize(first.title);
  const artist = normalize(first.artist);
  if (songs.length === 1 && text === title) return true;
  return text === `${artist} ${title}` || text === `${title} ${artist}`;
}

export function youtubeVideoUrl(value) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    let id;
    if (host === 'youtu.be' || host === 'www.youtu.be') id = url.pathname.split('/')[1];
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v')
        : /^\/(?:shorts|embed|live)\/([^/]+)/.exec(url.pathname)?.[1];
    }
    return /^[\w-]{11}$/.test(id || '') ? `https://www.youtube.com/watch?v=${id}` : null;
  } catch { return null; }
}

export function videoOrigin(info, tab) {
  const link = youtubeVideoUrl(info.linkUrl);
  const url = link || youtubeVideoUrl(info.pageUrl || tab?.url);
  return url ? { url, title: link ? String(info.selectionText || '') : String(tab?.title || '') } : null;
}

export function matchedVideo(song, origin) {
  if (!origin || !youtubeVideoUrl(origin.url)) return null;
  const context = ` ${normalize(cleanQuery(origin.title))} `;
  const title = ` ${normalize(song.title)} `;
  const artist = ` ${normalize(song.artist)} `;
  return context.includes(title) && context.includes(artist) ? youtubeVideoUrl(origin.url) : null;
}

export function youtubeDestination(song) {
  const known = youtubeVideoUrl(song.videoUrl);
  return known || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.artist} ${song.title}`)}`;
}

export function splitUtf8(text, maxBytes = 480) {
  const encoder = new TextEncoder();
  const chunks = [];
  let current = '';
  for (const char of text) {
    if (encoder.encode(current + char).length > maxBytes && current) {
      const boundary = current.lastIndexOf(' ');
      if (boundary > current.length / 2) {
        chunks.push(current.slice(0, boundary));
        current = current.slice(boundary + 1);
      } else { chunks.push(current); current = ''; }
    }
    current += char;
  }
  if (current) chunks.push(current);
  return chunks;
}

export function decodeEntities(text) {
  const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘' };
  return String(text).replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, code) => {
    if (code[0] !== '#') return entities[code] ?? match;
    const number = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : match;
  });
}

export function defaultSession() {
  return {
    id: crypto.randomUUID(), view: 'search', query: '', results: [], favoritesQuery: '',
    reader: null, origin: null, autoOpen: false, searchScroll: 0, favoritesScroll: 0, readerScroll: 0,
  };
}
