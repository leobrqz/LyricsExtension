const messages = {
  search: ['Buscar', 'Search'], favorites: ['Favoritos', 'Favorites'], settings: ['Preferências', 'Settings'],
  contextMenu: ['Achar letras para “%s”', 'Find lyrics for “%s”'],
  welcome: ['O que está tocando?', 'What’s playing?'],
  welcomeText: ['Um título, um artista ou o que você lembrar. A próxima linha está por aqui.', 'A title, an artist, or whatever you remember. Your next line is here.'],
  searchPlaceholder: ['Busque uma música ou artista', 'Search for a song or artist'],
  searchLabel: ['Buscar letras de músicas', 'Search for song lyrics'], clear: ['Limpar busca', 'Clear search'],
  searching: ['Encontrando suas próximas linhas…', 'Finding your next lines…'],
  results: ['Músicas encontradas', 'Matching songs'], resultCount: ['{count} opções para explorar', '{count} songs to explore'],
  noResults: ['Nenhuma música por aqui', 'No matching songs yet'],
  noResultsText: ['Tente menos palavras, outra grafia ou acrescente o artista.', 'Try fewer words, another spelling, or add the artist.'],
  searchError: ['A busca não respondeu', 'Search couldn’t connect'],
  unavailable: ['Não foi possível acessar o serviço. Confira sua conexão e tente novamente.', 'Couldn’t reach the service. Check your connection and try again.'],
  timeout: ['O serviço está demorando mais que o esperado. Tente novamente.', 'The service is taking longer than expected. Please try again.'],
  slow: ['Ainda procurando… você pode ajustar a busca enquanto espera.', 'Still looking… you can edit your search while you wait.'],
  retry: ['Tentar novamente', 'Try again'], back: ['Voltar', 'Back'],
  fetchingLyrics: ['Abrindo a letra…', 'Opening the lyrics…'], lyricsLabel: ['LETRA', 'LYRICS'],
  noLyrics: ['Esta letra ainda não apareceu', 'These lyrics aren’t available yet'],
  noLyricsText: ['A música foi identificada, mas a fonte não forneceu sua letra. Tente outra versão ou tente novamente depois.', 'The song was identified, but the source didn’t provide its lyrics. Try another version or try again later.'],
  lyricsError: ['Não foi possível abrir a letra', 'Couldn’t open the lyrics'],
  addFavorite: ['Adicionar aos favoritos', 'Add to favorites'], removeFavorite: ['Remover dos favoritos', 'Remove from favorites'],
  saved: ['Salva nos favoritos', 'Saved to favorites'], removed: ['Removida dos favoritos', 'Removed from favorites'],
  undo: ['Desfazer', 'Undo'], favoriteTitle: ['Suas favoritas', 'Your favorites'],
  favoriteSubtitle: ['As músicas que merecem mais uma leitura.', 'The songs worth reading again.'],
  favoritesPlaceholder: ['Pesquisar nos favoritos', 'Search your favorites'],
  emptyFavorites: ['Um lugar para suas favoritas', 'A home for your favorites'],
  emptyFavoritesText: ['Toque na estrela de uma letra para guardar a música aqui.', 'Tap the star on a lyric to keep the song here.'],
  emptyFilter: ['Nenhum favorito com esse nome', 'No favorites match that search'],
  emptyFilterText: ['Tente outro título ou artista, ou procure entre todas as músicas.', 'Try another title or artist, or search all songs.'],
  searchAll: ['Buscar todas as músicas', 'Search all songs'],
  showTranslation: ['Ver tradução', 'Show translation'], hideTranslation: ['Ocultar tradução', 'Hide translation'],
  translateFrom: ['Idioma da letra', 'Lyrics language'], translateTo: ['Traduzir para', 'Translate to'],
  translating: ['Traduzindo verso a verso… {done}/{total}', 'Translating line by line… {done}/{total}'],
  automaticTranslation: ['Tradução automática · MyMemory', 'Automatic translation · MyMemory'],
  translationUnavailable: ['A tradução não está disponível agora. A letra original continua aqui.', 'Translation isn’t available right now. The original lyrics are still here.'],
  translationPartial: ['Alguns versos não puderam ser traduzidos. Tente completar a tradução.', 'Some lines couldn’t be translated. Try completing the translation.'],
  translationQuota: ['O limite diário gratuito de tradução foi atingido. Tente novamente mais tarde.', 'The free daily translation limit has been reached. Please try again later.'],
  sameLanguage: ['A letra já está nesse idioma. Escolha outro idioma de destino.', 'The lyrics are already in this language. Choose another target language.'],
  unknownLanguage: ['Escolha o idioma da letra para traduzir.', 'Choose the lyrics language to translate.'],
  chooseLanguage: ['Selecionar idioma', 'Choose a language'],
  youtubeOpen: ['Abrir no YouTube', 'Open on YouTube'], youtubeSearch: ['Buscar no YouTube', 'Search on YouTube'],
  lyricSource: ['Letra fornecida por', 'Lyrics provided by'],
  language: ['Idioma da interface', 'Interface language'], translationPreference: ['Idioma de tradução', 'Translation language'],
  preferenceIntro: ['Uma experiência do seu jeito.', 'Make yourself at home.'],
  about: ['Sobre o projeto', 'About the project'],
  aboutText: ['Letras por perto. Código aberto, sem conta e sem anúncios.', 'Lyrics within reach. Open source, no account, no ads.'],
  repository: ['Código e contribuições', 'Code and contributions'], privacy: ['Seus dados', 'Your data'],
  privacyText: ['Suas buscas são enviadas ao lyrics.ovh. Ao ativar a tradução, os versos são enviados à MyMemory. Favoritos e preferências ficam salvos neste Firefox. Não coletamos histórico nem telemetria.', 'Your searches are sent to lyrics.ovh. When you enable translation, the lines are sent to MyMemory. Favorites and preferences stay in this Firefox. We collect no browsing history or telemetry.'],
  translationLimits: ['A tradução usa a cota gratuita da MyMemory. O serviço pode aplicar um limite diário por conexão.', 'Translation uses MyMemory’s free allowance. The service may apply a daily limit per connection.'],
  storedData: ['Favoritos incluem a letra e traduções já carregadas para permitir a releitura. Remover um favorito apaga sua cópia salva. A tela atual é lembrada somente durante esta sessão do navegador.', 'Favorites include previously loaded lyrics and translations for reading again. Removing a favorite deletes its saved copy. Your current screen is remembered only during this browser session.'],
  services: ['Fontes de conteúdo', 'Content sources'],
  storageError: ['Não foi possível salvar a alteração. Tente novamente.', 'Couldn’t save this change. Please try again.'],
  offlineFavorite: ['Cópia salva nos favoritos', 'Saved favorite copy'],
  keyboardHint: ['Selecione um texto em qualquer página e clique com o botão direito para buscar.', 'Select text on any page and right-click to find lyrics.'],
  ready: ['Sua próxima linha.', 'Your next line.'],
  untitled: ['Sem título', 'Untitled'],
};

export function initialPreferences(language = 'en') {
  const locale = language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
  return { locale, translationTarget: locale === 'pt-BR' ? 'pt' : 'en' };
}

export function t(locale, key, values = {}) {
  const text = messages[key]?.[locale === 'pt-BR' ? 0 : 1] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

export const translationLanguages = ['en', 'pt', 'es', 'fr', 'de', 'it', 'nl', 'pl', 'ru', 'uk', 'ja', 'ko', 'zh', 'ar', 'hi', 'tr', 'sv', 'da', 'fi', 'el', 'ro', 'hu', 'vi', 'id', 'th', 'he'];

export function languageName(code, locale) {
  try { return new Intl.DisplayNames([locale], { type: 'language' }).of(code); }
  catch { return code; }
}

export const messageKeys = Object.keys(messages);
