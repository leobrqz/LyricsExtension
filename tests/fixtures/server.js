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

const translations = [
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
    if (url.pathname === '/get') {
      if (translationFailure === 'quota') {
        response.end(JSON.stringify({ responseStatus: 429, quotaFinished: true, responseData: { translatedText: 'MYMEMORY WARNING' } })); return;
      }
      const query = url.searchParams.get('q');
      const index = sampleLyrics.split('\n').indexOf(query);
      response.end(JSON.stringify({ responseStatus: 200, quotaFinished: false, responseData: { translatedText: index >= 0 ? translations[index] : 'Tradução de teste' } })); return;
    }
    response.writeHead(404); response.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, requests,
    setTranslationFailure(value) { translationFailure = value; },
    setUnavailable(value) { unavailable = value; },
    close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
