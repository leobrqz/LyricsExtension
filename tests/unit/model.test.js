import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanQuery, uniqueSongs, filterFavorites, lyricLines, confidentMatch, songKey, youtubeVideoUrl, videoOrigin, matchedVideo, youtubeDestination } from '../../src/src/model.js';

test('free queries preserve titles and meaningful versions while removing video noise', () => {
  assert.equal(cleanQuery('  Remember\n the Time  '), 'Remember the Time');
  assert.equal(cleanQuery('Michael Jackson - Remember the Time (Official Video)'), 'Michael Jackson Remember the Time');
  assert.equal(cleanQuery('Window Songs (Live)'), 'Window Songs (Live)');
  assert.equal(cleanQuery('Musca Y'), 'Musca Y');
});

test('discovery deduplicates only the same song and version and rejects malformed metadata', () => {
  const songs = uniqueSongs([
    { title: 'Canção', artist: { name: 'Um Artista' } },
    { title: 'CANCAO', artist: { name: 'um artista' } },
    { title: 'Canção (Ao vivo)', artist: { name: 'Um Artista' } },
    { title: 'Canção', artist: { name: 'Outro Artista' } },
    { title: null, artist: {} },
  ]);
  assert.equal(songs.length, 3);
});

test('ambiguous titles stay in the candidate list instead of opening the first artist', () => {
  const songs = [{ title: 'Hello', artist: 'Adele' }, { title: 'Hello', artist: 'Lionel Richie' }];
  assert.equal(confidentMatch(songs, 'Hello'), false);
  assert.equal(confidentMatch(songs, 'Adele - Hello'), true);
  assert.equal(confidentMatch(songs, 'Hello Adele'), true);
});

test('favorite search tolerates accents and word order without requiring network', () => {
  const favorites = [{ song: { title: 'Canção Azul', artist: 'José da Rua' } }, { song: { title: 'Outra', artist: 'Someone' } }];
  assert.equal(filterFavorites(favorites, 'jose cancao').length, 1);
  assert.equal(filterFavorites(favorites, '').length, 2);
  assert.equal(songKey(favorites[0].song), 'jose da rua::cancao azul');
});

test('lyrics retain verse indices, stanza breaks, repetitions, and non-Latin text', () => {
  assert.deepEqual(lyricLines(' one  \r\n二\r\n\r\none\r\n'), ['one', '二', '', 'one']);
});

test('YouTube links are restricted to real hosts and video identifiers', () => {
  const video = 'https://www.youtube.com/watch?v=AbCdEfGhI12';
  assert.equal(youtubeVideoUrl('https://youtu.be/AbCdEfGhI12?t=20'), video);
  assert.equal(youtubeVideoUrl('https://youtube.com/shorts/AbCdEfGhI12'), video);
  assert.equal(youtubeVideoUrl('https://youtube.com.evil.test/watch?v=AbCdEfGhI12'), null);
  assert.equal(youtubeVideoUrl('javascript:alert(1)'), null);
  assert.equal(youtubeVideoUrl('https://youtube.com/watch?v=nope'), null);
});

test('video association requires both the chosen artist and title in the origin', () => {
  const song = { title: 'Window Songs', artist: 'Night Letters' };
  const origin = videoOrigin({ pageUrl: 'https://youtube.com/watch?v=AbCdEfGhI12' }, { title: 'Night Letters - Window Songs (Official Video) - YouTube' });
  assert.equal(matchedVideo(song, origin), 'https://www.youtube.com/watch?v=AbCdEfGhI12');
  assert.equal(matchedVideo({ ...song, artist: 'Other Voices' }, origin), null);
  assert.equal(matchedVideo({ ...song, title: 'Something Else' }, origin), null);
  assert.match(youtubeDestination({ ...song, videoUrl: 'javascript:alert(1)' }), /^https:\/\/www.youtube.com\/results\?search_query=Night%20Letters%20Window%20Songs$/);
});
