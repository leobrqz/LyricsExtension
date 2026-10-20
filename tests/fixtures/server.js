import http from 'node:http';

export const sampleLyrics = [
  'The rain is singing at my window',
  'I leave a little light for you',
  'The city whispers through the evening',
  'And every road is turning blue',
  '',
  'The rain is singing at my window',
  'I hear the morning calling me',
  'We write our stories on the sidewalk',
  'And let the quiet set us free',
  '',
  'A thousand stars above the river',
  'A thousand reasons to begin',
  'I keep the music of this moment',
  'And let a little daylight in',
].join('\n');

export const translations = [
  'A chuva canta na minha janela', 'Deixo uma pequena luz para você',
  'A cidade sussurra pela noite', 'E cada estrada fica azul', '',
  'A chuva canta na minha janela', 'Ouço a manhã me chamando',
  'Escrevemos nossas histórias na calçada', 'E deixamos o silêncio nos libertar', '',
  'Mil estrelas sobre o rio', 'Mil motivos para começar',
  'Guardo a música deste momento', 'E deixo entrar um pouco de luz',
];

export const fixtureTracks = [
  { title: 'Window Songs', artist: { name: 'Night Letters' }, album: { title: 'Quiet Hours' }, duration: 242 },
  { title: 'Window Songs', artist: { name: 'Other Voices' }, duration: 184 },
  { title: 'Window Songs (Acoustic)', artist: { name: 'Night Letters' }, duration: 219 },
];

export async function fixtureServer() {
  const requests = [];
  let translationFailure = null;
  let letrasUnavailable = false;
  let wrongAlias = false;
  let unavailable = false;
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    requests.push(url.pathname + url.search);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/page') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end('<!doctype html><html><head><title>A page with music</title></head><body><p><a id="song-link" href="https://www.youtube.com/watch?v=AbCdEfGhI12">Night Letters - Window Songs (Official Video)</a></p><p id="selection">Window Songs</p></body></html>');
      return;
    }
    if (unavailable) { response.writeHead(503); response.end('{}'); return; }
    if (url.pathname.startsWith('/night-letters/') || url.pathname.startsWith('/other-voices/')) {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      const translated = url.pathname.endsWith('/traducao.html');
      if (letrasUnavailable || (translated && translationFailure === 'unavailable')) { response.writeHead(503); response.end('Unavailable'); return; }
      if (url.pathname === '/night-letters/') {
        response.end('<html><body><h1>Night Letters</h1><a title="Window Songs" href="/night-letters/123/">Window Songs</a><a title="Window Songs (Pepsi Version)" href="/night-letters/window-songs/">Window Songs (Pepsi Version)</a></body></html>'); return;
      }
      if (url.pathname.includes('missing-verse')) { response.writeHead(404); response.end('Not found'); return; }
      const originalPath = url.pathname.replace(/traducao\.html$/, '');
      if (translated && translationFailure === 'missing') { response.writeHead(302, { Location: originalPath }); response.end(); return; }
      const canonical = 'https://www.letras.mus.br' + url.pathname;
      const title = wrongAlias && originalPath === '/night-letters/window-songs/' ? 'Window Songs (Pepsi Version)'
        : url.pathname.includes('acoustic') ? 'Window Songs (Acoustic)' : 'Window Songs';
      const paragraphs = sampleLyrics.split('\n\n').map((paragraph, p) => `<p>${paragraph.split('\n').map((line, i) => {
        const translation = translations.filter(Boolean)[p * 4 + i];
        return translated ? `<span class="verse"><span>${translation}</span><span class="romanization">${line}</span></span>` : line;
      }).join('<br>')}</p>`).join('');
      response.end(`<html><head><link rel="canonical" href="${canonical}"></head><body><h1>${title}</h1><div class="${translated ? 'lyric-stackedTranslation' : 'lyric-original'}">${paragraphs}</div></body></html>`);
      return;
    }
    if (url.pathname.startsWith('/suggest/')) {
      const query = decodeURIComponent(url.pathname.slice('/suggest/'.length)).toLowerCase();
      if (query === 'offline') { response.writeHead(503); response.end('{}'); return; }
      if (query === 'older') await new Promise(resolve => setTimeout(resolve, 950));
      if (query === 'newer') await new Promise(resolve => setTimeout(resolve, 30));
      const data = query === 'nothing' ? [] : query === 'markup' ? [{ title: '<img src=x onerror="window.injected=true">', artist: { name: '<script>bad</script>' } }]
        : query === 'missing' ? [{ title: 'Missing Verse', artist: { name: 'Night Letters' } }]
        : query === 'older' ? [{ title: 'Older Result', artist: { name: 'Previous Query' } }]
        : query === 'newer' ? [{ title: 'Newer Result', artist: { name: 'Current Query' } }]
        : fixtureTracks;
      response.end(JSON.stringify({ data, total: data.length })); return;
    }
    if (url.pathname.startsWith('/v1/')) {
      if (url.pathname.includes('Missing%20Verse')) { response.writeHead(404); response.end(JSON.stringify({ error: 'No lyrics found' })); return; }
      response.end(JSON.stringify({ lyrics: sampleLyrics })); return;
    }
    response.writeHead(404); response.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, requests,
    setTranslationFailure(value) { translationFailure = value; },
    setLetrasUnavailable(value) { letrasUnavailable = value; },
    setWrongAlias(value) { wrongAlias = value; },
    setUnavailable(value) { unavailable = value; },
    close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
