import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Code2,
  ExternalLink,
  Heart,
  LockKeyhole,
  Menu,
  Minus,
  MousePointer2,
  Plus,
  Search,
  SquarePlay,
  WifiOff,
  X,
} from 'lucide-react';
import { COPY, LINKS, SONGS } from './content.js';

function Mark({ className = '' }) {
  return (
    <svg
      className={className}
      width="25"
      height="27"
      viewBox="0 0 28 30"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 10v10M10 3v24M17 7v16M24 11v8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Brand({ footer = false }) {
  return (
    <a
      className={`brand flex items-center ${footer ? 'brand-footer' : ''}`}
      href="#top"
      aria-label="Lyrics, Please — home"
    >
      <Mark />
      <span>
        Lyrics, Please<span className="brand-period">.</span>
      </span>
    </a>
  );
}

function InstallLink({ t, compact = false, light = false }) {
  return (
    <a
      href={LINKS.firefox}
      className={`install-link inline-flex items-center justify-between gap-5 ${compact ? 'compact' : ''} ${light ? 'on-light' : ''}`}
    >
      <span>{t.add}</span>
      <ArrowUpRight size={compact ? 16 : 19} aria-hidden="true" />
    </a>
  );
}

function Record() {
  return (
    <div className="record" aria-hidden="true">
      <svg viewBox="0 0 540 540">
        <circle cx="270" cy="270" r="268" fill="#111312" stroke="#363b35" />
        {Array.from({ length: 38 }, (_, i) => (
          <circle
            key={i}
            cx="270"
            cy="270"
            r={112 + i * 4}
            fill="none"
            stroke={i % 4 === 0 ? '#343831' : '#272b26'}
            strokeWidth=".7"
          />
        ))}
        <circle cx="270" cy="270" r="102" fill="#c6d59f" />
        <circle cx="270" cy="270" r="94" fill="none" stroke="#5b6944" strokeWidth=".7" />
        <text
          x="270"
          y="216"
          textAnchor="middle"
          fill="#263023"
          fontSize="13"
          fontWeight="600"
          letterSpacing="2"
        >
          LYRICS, PLEASE
        </text>
        <text x="270" y="240" textAnchor="middle" fill="#536042" fontSize="8" letterSpacing="2">
          FOR THE RECORD
        </text>
        <path d="M188 270h57m50 0h57" stroke="#7d8b61" strokeWidth=".7" />
        <text x="270" y="310" textAnchor="middle" fill="#536042" fontSize="9" letterSpacing="2">
          SIDE A
        </text>
        <circle cx="270" cy="270" r="13" fill="#191c18" stroke="#8b9b71" strokeWidth="2" />
        <circle cx="270" cy="270" r="3" fill="#abb48e" />
      </svg>
    </div>
  );
}

function SongRow({ song, onOpen, favorite, onFavorite, t }) {
  return (
    <li className="demo-song-row flex items-center">
      <button
        className="demo-song-open flex flex-1 items-center gap-3 text-left"
        onClick={() => onOpen(song)}
      >
        <span className="demo-song-text">
          <strong>{song.title}</strong>
          <span>{song.artist}</span>
        </span>
        <ChevronRight size={14} aria-hidden="true" />
      </button>
      {onFavorite && (
        <button
          className="demo-remove"
          onClick={() => onFavorite(song.id)}
          aria-label={`${favorite ? t.saved : t.save}: ${song.title}`}
          aria-pressed={favorite}
        >
          <Heart size={14} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      )}
    </li>
  );
}

function ExtensionPreview({ t }) {
  const [view, setView] = useState('reader');
  const [song, setSong] = useState(SONGS[0]);
  const [translation, setTranslation] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [favorites, setFavorites] = useState(['greensleeves']);
  const [recent, setRecent] = useState(['amazing-grace']);
  const reader = useRef(null);
  const active = view === 'reader' ? 'search' : view;
  const isSaved = favorites.includes(song.id);

  function openSong(nextSong) {
    setSong(nextSong);
    setTranslation(false);
    setRecent((previous) => [nextSong.id, ...previous.filter((id) => id !== nextSong.id)]);
    setView('reader');
  }

  function toggleFavorite(id) {
    setFavorites((previous) =>
      previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id],
    );
  }

  useEffect(() => {
    if (reader.current) reader.current.scrollTop = 0;
  }, [view, song]);

  const normalize = (value) =>
    value
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const searchResults = SONGS.filter((item) =>
    normalize(`${item.title} ${item.artist}`).includes(normalize(query.trim())),
  );
  const favoriteResults = SONGS.filter(
    (item) =>
      favorites.includes(item.id) &&
      normalize(`${item.title} ${item.artist}`).includes(normalize(filter.trim())),
  );
  const recentSongs = recent.map((id) => SONGS.find((item) => item.id === id));

  return (
    <div className="extension-preview" id="try-it" aria-label={t.demoNote}>
      <div className="demo-brand flex items-center justify-between">
        <span>Lyrics, Please</span>
        <Mark />
      </div>
      <nav className="demo-nav flex" aria-label={t.demoNote}>
        {['search', 'favorites', 'recent'].map((tab) => (
          <button
            key={tab}
            className={active === tab ? 'is-active' : ''}
            aria-pressed={active === tab}
            onClick={() => setView(tab)}
          >
            {t[tab]}
          </button>
        ))}
      </nav>
      <div
        className={`demo-content ${view === 'reader' ? 'demo-reader' : 'demo-list-view'}`}
        ref={reader}
      >
        {view === 'reader' ? (
          <>
            <div className="demo-reader-head">
              <button
                className="demo-back inline-flex items-center gap-1"
                onClick={() => setView('search')}
              >
                <ArrowLeft size={12} />
                {t.back}
              </button>
              <h2>{song.title}</h2>
              <div className="demo-meta flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{song.artist}</span>
                <span className="demo-sample-source">{t.sample}</span>
              </div>
              <div className="demo-actions flex items-center">
                <button
                  className={`inline-flex items-center gap-1.5 ${isSaved ? 'is-saved' : ''}`}
                  onClick={() => toggleFavorite(song.id)}
                  aria-pressed={isSaved}
                >
                  <Heart size={14} fill={isSaved ? 'currentColor' : 'none'} />
                  <span>{isSaved ? t.saved : t.save}</span>
                </button>
                <span className="demo-action-divider" />
                <a
                  className="inline-flex items-center gap-1.5"
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(song.title + ' ' + song.artist)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <SquarePlay size={15} />
                  {t.youtube}
                </a>
                <button
                  className="demo-translation inline-flex items-center gap-2"
                  role="switch"
                  aria-checked={translation}
                  onClick={() => setTranslation(!translation)}
                >
                  <span className="demo-switch" />
                  <span>{t.translation}</span>
                </button>
              </div>
            </div>
            <div className="demo-verses">
              {translation && <p className="demo-translation-note">{t.sampleTranslation}</p>}
              {song.lines.map((line, index) =>
                line ? (
                  <div key={index} className="demo-verse">
                    <p>{line[0]}</p>
                    {translation && <p className="demo-translated">{line[1]}</p>}
                  </div>
                ) : (
                  <div key={index} className="demo-stanza-break" />
                ),
              )}
            </div>
          </>
        ) : (
          <>
            {view !== 'search' && (
              <div className="demo-collection-title flex items-baseline justify-between">
                <h2>{t[view]}</h2>
                <span>{view === 'favorites' ? favorites.length : recent.length}</span>
              </div>
            )}
            {view !== 'recent' && (
              <div className="demo-search flex items-center gap-3">
                <Search size={14} aria-hidden="true" />
                <input
                  aria-label={view === 'favorites' ? t.filter : t.query}
                  placeholder={view === 'favorites' ? t.filter : t.query}
                  value={view === 'favorites' ? filter : query}
                  onChange={(event) =>
                    view === 'favorites'
                      ? setFilter(event.target.value)
                      : setQuery(event.target.value)
                  }
                />
                {(view === 'favorites' ? filter : query) && (
                  <button
                    onClick={() => (view === 'favorites' ? setFilter('') : setQuery(''))}
                    aria-label={t.clear}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            )}
            {view === 'search' && <p className="demo-list-label">{t.suggestions}</p>}
            <ul className="demo-songs">
              {(view === 'favorites'
                ? favoriteResults
                : view === 'recent'
                  ? recentSongs
                  : searchResults
              ).map((item) => (
                <SongRow
                  key={item.id}
                  song={item}
                  onOpen={openSong}
                  t={t}
                  favorite={favorites.includes(item.id)}
                  onFavorite={view === 'favorites' ? toggleFavorite : undefined}
                />
              ))}
            </ul>
            {view === 'search' && searchResults.length === 0 && (
              <p className="demo-empty">
                {t.noResults}
                <span>{t.previewHint}</span>
              </p>
            )}
            {view === 'favorites' && favoriteResults.length === 0 && (
              <p className="demo-empty">{favorites.length ? t.noResults : t.emptyFavorites}</p>
            )}
            {view === 'recent' && recentSongs.length === 0 && (
              <p className="demo-empty">{t.emptyRecent}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ContextPreview({ t, onTry }) {
  return (
    <div className="context-scene">
      <div className="context-browser">
        <div className="context-chrome flex items-center gap-3">
          <ArrowLeft size={12} />
          <div className="context-address flex items-center gap-2">
            <LockKeyhole size={10} />
            <span>youtube.com</span>
          </div>
          <Menu size={13} />
        </div>
        <div className="context-video flex items-center justify-center">
          <Mark />
          <span>
            AMAZING
            <br />
            GRACE
          </span>
          <span className="video-corner">
            JOHN NEWTON
            <br />
            1779
          </span>
        </div>
        <p className="context-video-title">
          <span>{t.selected}</span>
        </p>
        <span className="context-selection-caret" />
      </div>
      <button className="context-menu flex items-center gap-3 text-left" onClick={onTry}>
        <Search size={15} />
        <span>{t.context}</span>
        <ArrowUpRight size={14} />
      </button>
      <MousePointer2
        className="context-cursor"
        size={26}
        fill="#f2f1e8"
        strokeWidth="1.5"
        aria-hidden="true"
      />
      <p className="context-caption">
        {t.contextCaption}
        <ArrowUpRight size={15} />
      </p>
    </div>
  );
}

function Collection({ t }) {
  return (
    <div className="collection-art">
      <div className="collection-top flex items-center justify-between">
        <span>{t.collectionLabel}</span>
        <Heart size={15} />
      </div>
      <div className="collection-list">
        {SONGS.map((song, index) => (
          <div className="collection-song flex items-center" key={song.id}>
            <span className="collection-index">0{index + 1}</span>
            <div className="collection-song-name">
              <strong>{song.title}</strong>
              <span>{song.artist}</span>
            </div>
            <Check size={15} aria-hidden="true" />
          </div>
        ))}
      </div>
      <div className="collection-bottom flex items-center justify-between">
        <span>{t.collectionCount}</span>
        <span className="inline-flex items-center gap-2">
          <WifiOff size={12} />
          {t.offline}
        </span>
      </div>
    </div>
  );
}

function FAQ({ t }) {
  const [open, setOpen] = useState(0);
  return (
    <section className="faq-section page-width grid" id="questions">
      <div>
        <p className="eyebrow">{t.faqEyebrow}</p>
        <h2>{t.faqTitle}</h2>
      </div>
      <div className="faq-list">
        {t.faq.map(({ q, a }, i) => (
          <div className={`faq-item ${open === i ? 'is-open' : ''}`} key={i}>
            <h3>
              <button
                className="flex w-full items-center justify-between gap-6 text-left"
                aria-expanded={open === i}
                aria-controls={`answer-${i}`}
                onClick={() => setOpen(open === i ? -1 : i)}
              >
                {q}
                {open === i ? <Minus size={17} /> : <Plus size={17} />}
              </button>
            </h3>
            <div className="faq-answer" id={`answer-${i}`} aria-hidden={open !== i}>
              <div>
                <p>{a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [language, setLanguage] = useState('en');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [demoSeed, setDemoSeed] = useState(0);
  const t = COPY[language];

  useEffect(() => {
    document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
    document.title =
      language === 'pt'
        ? 'Lyrics, Please — As palavras da sua música.'
        : 'Lyrics, Please — The words to your music.';
  }, [language]);

  function tryContextSearch() {
    setDemoSeed((previous) => previous + 1);
    requestAnimationFrame(() =>
      document
        .getElementById('try-it')
        ?.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
          block: 'center',
        }),
    );
  }

  return (
    <>
      <a className="skip-link" href="#main">
        {t.skip}
      </a>
      <div id="top" />
      <header className="site-header page-width flex items-center justify-between">
        <Brand />
        <nav
          className={`site-nav flex items-center ${mobileMenu ? 'mobile-open' : ''}`}
          aria-label={language === 'pt' ? 'Navegação principal' : 'Main navigation'}
        >
          <a href="#closer-look" onClick={() => setMobileMenu(false)}>
            {t.closer}
          </a>
          <a href="#questions" onClick={() => setMobileMenu(false)}>
            {t.questions}
          </a>
          <a className="nav-source inline-flex items-center gap-2" href={LINKS.github}>
            <Code2 size={15} />
            GitHub
            <ArrowUpRight size={12} />
          </a>
        </nav>
        <div className="header-actions flex items-center">
          <div className="language-switch flex" role="group" aria-label="Language / Idioma">
            <button
              className={language === 'en' ? 'selected' : ''}
              onClick={() => setLanguage('en')}
              aria-pressed={language === 'en'}
              lang="en"
              aria-label="English"
            >
              EN
            </button>
            <span aria-hidden="true">/</span>
            <button
              className={language === 'pt' ? 'selected' : ''}
              onClick={() => setLanguage('pt')}
              aria-pressed={language === 'pt'}
              lang="pt-BR"
              aria-label="Português"
            >
              PT
            </button>
          </div>
          <InstallLink t={t} compact />
          <button
            className="mobile-menu-button"
            aria-expanded={mobileMenu}
            aria-label={language === 'pt' ? 'Abrir menu' : 'Open menu'}
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            {mobileMenu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <main id="main">
        <section className="hero page-width grid">
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow inline-flex items-center gap-2.5">
              <span className="status-dot" />
              {t.eyebrow}
            </p>
            <h1>
              <span>{t.hero[0]}</span>
              <span>
                {t.hero[1]} <em>{t.hero[2]}</em>
              </span>
            </h1>
            <p className="hero-intro">{t.intro}</p>
            <div className="hero-cta">
              <InstallLink t={t} />
              <p>{t.heroNote}</p>
            </div>
            <a className="hero-scroll inline-flex items-center gap-3" href="#closer-look">
              <ArrowDown size={15} />
              {t.scroll}
            </a>
          </div>
          <div className="hero-stage">
            <span className="stage-rule" aria-hidden="true" />
            <Record />
            <ExtensionPreview t={t} key={demoSeed} />
            <div className="demo-caption">
              <span className="demo-caption-line" />
              <span>{t.demoCaption}</span>
              <ArrowUpRight size={16} />
            </div>
            <p className="demo-disclaimer">{t.demoNote}</p>
          </div>
        </section>

        <div className="feature-strip page-width flex items-center justify-between">
          {t.strip.map((text, i) => (
            <span className="inline-flex items-center gap-3" key={text}>
              <span className="strip-number">0{i + 1}</span>
              {text}
            </span>
          ))}
          <span className="strip-symbol" aria-hidden="true">
            ✳
          </span>
        </div>

        <section className="details-section" id="closer-look">
          <div className="page-width">
            <div className="details-heading">
              <p className="eyebrow">{t.detailsEyebrow}</p>
              <h2>
                {t.detailsTitle[0]}
                <br />
                <em>{t.detailsTitle[1]}</em>
              </h2>
            </div>
            <div className="details-body grid">
              <ContextPreview t={t} onTry={tryContextSearch} />
              <div className="feature-list">
                {t.features.map((feature, i) => (
                  <article className="feature-row grid" key={feature.title}>
                    <span className="feature-number">0{i + 1}</span>
                    <div>
                      <h3>{feature.title}</h3>
                      <p>{feature.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="ownership-section page-width grid">
          <div className="ownership-copy">
            <p className="eyebrow">{t.privacyEyebrow}</p>
            <h2>
              {t.privacyTitle[0]}
              <br />
              <em>{t.privacyTitle[1]}</em>
            </h2>
            <p className="ownership-description">{t.privacyText}</p>
            <a className="text-link inline-flex items-center gap-3" href={LINKS.github}>
              {t.githubLink}
              <ArrowUpRight size={16} />
            </a>
            <p className="ownership-fine-print">
              {t.finePrint}{' '}
              <a href={LINKS.privacy}>
                {t.privacyLink}
                <ArrowUpRight size={11} />
              </a>
            </p>
          </div>
          <Collection t={t} />
        </section>

        <FAQ t={t} />

        <section className="closing-section">
          <div className="page-width flex items-center justify-between">
            <div>
              <p>{t.finalNote}</p>
              <h2>
                {t.finalTitle[0]}
                <br />
                <em>{t.finalTitle[1]}</em>
              </h2>
            </div>
            <InstallLink t={t} light />
          </div>
        </section>
      </main>

      <footer className="site-footer page-width">
        <div className="footer-main flex items-start justify-between">
          <div>
            <Brand footer />
            <p className="footer-tag">{t.footerTag}</p>
          </div>
          <div className="footer-links flex flex-wrap">
            <a href={LINKS.github}>
              GitHub
              <ArrowUpRight size={12} />
            </a>
            <a href={LINKS.sourceforge}>
              SourceForge
              <ArrowUpRight size={12} />
            </a>
            <a href={LINKS.privacy}>{t.privacy}</a>
            <a href={LINKS.issues}>{t.issues}</a>
          </div>
        </div>
        <div className="footer-bottom flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <Code2 size={13} />
            Open source · MIT
          </span>
          <a href="https://sourceforge.net/projects/lyricsplease/">
            {t.hosted}
            <ExternalLink size={10} />
          </a>
        </div>
      </footer>
    </>
  );
}
