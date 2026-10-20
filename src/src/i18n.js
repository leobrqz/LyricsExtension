const messages = {
  search: ['Buscar', 'Search'], favorites: ['Favoritos', 'Favorites'], recents: ['Recentes', 'Recent'], settings: ['Preferências', 'Settings'],
  contextMenu: ['Achar letras para “%s”', 'Find lyrics for “%s”'],
  searchPlaceholder: ['Música ou artista', 'Song or artist'],
  searchLabel: ['Buscar letras de músicas', 'Search for song lyrics'], clear: ['Limpar busca', 'Clear search'],
  searching: ['Buscando músicas…', 'Searching…'],
  results: ['Resultados', 'Results'],
  songCount: ['{count} músicas', '{count} songs'], songCountOne: ['{count} música', '{count} song'],
  noResults: ['Nenhuma música encontrada', 'No songs found'],
  noResultsText: ['Tente menos palavras, outra grafia ou acrescente o artista.', 'Try fewer words, another spelling, or add the artist.'],
  searchError: ['A busca não respondeu', 'Search couldn’t connect'],
  unavailable: ['Não foi possível acessar o serviço. Confira sua conexão e tente novamente.', 'Couldn’t reach the service. Check your connection and try again.'],
  timeout: ['O serviço está demorando mais que o esperado. Tente novamente.', 'The service is taking longer than expected. Please try again.'],
  slow: ['Ainda procurando… você pode ajustar a busca enquanto espera.', 'Still looking… you can edit your search while you wait.'],
  retry: ['Tentar novamente', 'Try again'], back: ['Voltar', 'Back'],
  reloadLyrics: ['Atualizar letra', 'Reload lyrics'],
  fetchingLyrics: ['Carregando letra…', 'Loading lyrics…'], lyricsLabel: ['Letra', 'Lyrics'],
  noLyrics: ['Letra indisponível', 'Lyrics unavailable'],
  noLyricsText: ['A fonte não retornou a letra. Tente outra versão ou tente novamente.', 'The source did not return lyrics. Try another version or try again.'],
  lyricsError: ['Não foi possível abrir a letra', 'Couldn’t open the lyrics'],
  addFavorite: ['Adicionar aos favoritos', 'Add to favorites'], removeFavorite: ['Remover dos favoritos', 'Remove from favorites'],
  saved: ['Salva nos favoritos', 'Saved to favorites'], removed: ['Removida dos favoritos', 'Removed from favorites'],
  undo: ['Desfazer', 'Undo'], saveFavorite: ['Salvar', 'Save'], favoriteSaved: ['Salvo', 'Saved'],
  favoritesPlaceholder: ['Filtrar favoritos', 'Filter favorites'],
  emptyFavorites: ['Nenhum favorito', 'No favorites yet'],
  emptyFavoritesText: ['Use Salvar na letra de uma música para adicioná-la aqui.', 'Choose Save while reading a song to add it here.'],
  emptyRecents: ['Nenhuma música recente', 'No recent songs'],
  emptyRecentsText: ['Abra uma letra para encontrá-la aqui depois.', 'Open a song’s lyrics to find it here later.'],
  clearRecents: ['Limpar recentes', 'Clear recent songs'],
  emptyFilter: ['Nenhum favorito com esse nome', 'No favorites match that search'],
  emptyFilterText: ['Tente outro título ou artista, ou procure entre todas as músicas.', 'Try another title or artist, or search all songs.'],
  searchAll: ['Buscar todas as músicas', 'Search all songs'],
  translation: ['Tradução', 'Translation'],
  showTranslation: ['Mostrar tradução em português', 'Show Portuguese translation'], hideTranslation: ['Ocultar tradução', 'Hide translation'],
  loadingTranslation: ['Buscando a tradução publicada…', 'Finding the published translation…'],
  publishedTranslation: ['Tradução em português · Letras.mus.br', 'Portuguese translation · Letras.mus.br'],
  translationUnavailable: ['A tradução não está disponível agora. A letra original continua aqui.', 'Translation isn’t available right now. The original lyrics are still here.'],
  translationNotFound: ['Não encontramos uma tradução publicada em português. A letra original continua aqui.', 'No published Portuguese translation was found. The original lyrics are still here.'],
  translationMismatch: ['Os versos da tradução publicada não correspondem a esta versão da letra. Você pode consultar a música no Letras.', 'The published translation’s verses do not match this version of the lyrics. You can read the song on Letras.'],
  youtubeOpen: ['Abrir no YouTube', 'Open on YouTube'], youtubeSearch: ['Buscar no YouTube', 'Search on YouTube'],
  lyricSource: ['Letra fornecida por', 'Lyrics provided by'],
  lyricVia: ['Letra via', 'Lyrics via'],
  sourceUnknown: ['Origem não informada pela API', 'Original source not provided by the API'],
  tryLetras: ['Tentar pelo Letras', 'Try Letras directly'],
  language: ['Idioma da interface', 'Interface language'],
  about: ['Sobre o projeto', 'About the project'],
  aboutText: ['Código aberto, sem conta e sem anúncios.', 'Open source, no account, no ads.'],
  repository: ['Código e contribuições', 'Code and contributions'], privacy: ['Seus dados', 'Your data'],
  privacyText: ['Suas buscas são enviadas ao lyrics.ovh. Letras e traduções publicadas são consultadas diretamente no Letras pela sua conexão. A API fornece a letra quando o Letras não está disponível. Recentes, favoritos e preferências ficam salvos neste Firefox. Não lemos seu histórico de navegação nem coletamos telemetria.', 'Your searches are sent to lyrics.ovh. Lyrics and published translations are requested directly from Letras through your connection. The API supplies lyrics when Letras is unavailable. Recent songs, favorites, and preferences stay in this Firefox. We do not read browsing history or collect telemetry.'],
  contentSources: ['A tradução disponível é a publicada em português no Letras. A disponibilidade depende de cada música e do acesso ao site.', 'Translations are the Portuguese versions published on Letras. Availability depends on the song and access to the website.'],
  storedData: ['Favoritos incluem a letra e traduções já carregadas para permitir a releitura. Recentes guarda as últimas 50 músicas abertas e pode ser limpo nessa aba. A tela atual é lembrada somente durante esta sessão do navegador.', 'Favorites include previously loaded lyrics and translations for reading again. Recent keeps the last 50 opened songs and can be cleared from that tab. Your current screen is remembered only during this browser session.'],
  services: ['Fontes de conteúdo', 'Content sources'],
  storageError: ['Não foi possível salvar a alteração. Tente novamente.', 'Couldn’t save this change. Please try again.'],
  offlineFavorite: ['Cópia salva nos favoritos', 'Saved favorite copy'],
  keyboardHint: ['Selecione um texto em qualquer página e clique com o botão direito para buscar.', 'Select text on any page and right-click to find lyrics.'],
  untitled: ['Sem título', 'Untitled'],
};

export function initialPreferences(language = 'en') {
  const locale = language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
  return { locale };
}

export function t(locale, key, values = {}) {
  const text = messages[key]?.[locale === 'pt-BR' ? 0 : 1] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

export const messageKeys = Object.keys(messages);
